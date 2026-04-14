export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const webhook = process.env.BITRIX_WEBHOOK;
  if (!webhook) return new Response(JSON.stringify({ error: 'BITRIX_WEBHOOK not configured' }), { status: 500, headers: cors });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'deals';
  const categoryId = searchParams.get('category') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    if (action === 'categories') {
      const r = await fetch(`${webhook}/crm.dealcategory.list`);
      return new Response(JSON.stringify(await r.json()), { status: 200, headers: cors });
    }

    if (action === 'stages') {
      if (!categoryId) return new Response(JSON.stringify({ error: 'category required' }), { status: 400, headers: cors });
      const r = await fetch(`${webhook}/crm.dealcategory.stage.list?id=${categoryId}`);
      return new Response(JSON.stringify(await r.json()), { status: 200, headers: cors });
    }

    if (action === 'users') {
      const all = [];
      let start = 0;
      let go = true;
      while (go) {
        const r = await fetch(`${webhook}/user.get?ACTIVE=true&start=${start}`);
        const d = await r.json();
        if (d.result) all.push(...d.result.map(u => ({ ID: u.ID, NAME: `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim() })));
        if (d.next) start = d.next; else go = false;
      }
      return new Response(JSON.stringify({ result: all }), { status: 200, headers: cors });
    }

    if (action === 'deals') {
      if (!categoryId) return new Response(JSON.stringify({ error: 'category required' }), { status: 400, headers: cors });

      const allDeals = [];
      let start = 0;
      let go = true;
      const t0 = Date.now();

      while (go) {
        if (Date.now() - t0 > 8500) {
          return new Response(JSON.stringify({ result: allDeals, total: allDeals.length, partial: true }), { status: 200, headers: cors });
        }

        let url = `${webhook}/crm.deal.list?filter[CATEGORY_ID]=${categoryId}`;
        if (dateFrom) url += `&filter[>=DATE_CREATE]=${dateFrom}`;
        if (dateTo) url += `&filter[<=DATE_CREATE]=${dateTo}T23:59:59`;
        url += `&select[]=ID&select[]=TITLE&select[]=STAGE_ID&select[]=OPPORTUNITY`;
        url += `&select[]=CONTACT_ID&select[]=DATE_CREATE&select[]=DATE_MODIFY`;
        url += `&select[]=ASSIGNED_BY_ID&select[]=CLOSED&start=${start}`;

        const r = await fetch(url);
        const d = await r.json();
        if (d.result) allDeals.push(...d.result);
        if (d.next) start = d.next; else go = false;
      }

      return new Response(JSON.stringify({ result: allDeals, total: allDeals.length }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
