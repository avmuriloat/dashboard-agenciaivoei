export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const webhook = process.env.BITRIX_WEBHOOK;
  if (!webhook) {
    return new Response(
      JSON.stringify({ error: 'BITRIX_WEBHOOK not configured' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'deals';
  const categoryId = searchParams.get('category') || '';

  try {
    // Listar categorias (funneis)
    if (action === 'categories') {
      const res = await fetch(`${webhook}/crm.dealcategory.list`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
    }

    // Listar estágios de uma categoria
    if (action === 'stages') {
      if (!categoryId) {
        return new Response(
          JSON.stringify({ error: 'category parameter required' }),
          { status: 400, headers: corsHeaders }
        );
      }
      const res = await fetch(`${webhook}/crm.dealcategory.stage.list?id=${categoryId}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
    }

    // Listar deals com paginação completa
    if (action === 'deals') {
      if (!categoryId) {
        return new Response(
          JSON.stringify({ error: 'category parameter required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const allDeals = [];
      let start = 0;
      let hasMore = true;

      while (hasMore) {
        const url =
          `${webhook}/crm.deal.list` +
          `?filter[CATEGORY_ID]=${categoryId}` +
          `&select[]=ID&select[]=TITLE&select[]=STAGE_ID` +
          `&select[]=OPPORTUNITY&select[]=CONTACT_ID` +
          `&select[]=DATE_CREATE&select[]=DATE_MODIFY` +
          `&select[]=ASSIGNED_BY_ID&select[]=CLOSED` +
          `&start=${start}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.result) allDeals.push(...data.result);
        if (data.next) {
          start = data.next;
        } else {
          hasMore = false;
        }
      }

      return new Response(
        JSON.stringify({ result: allDeals, total: allDeals.length }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: categories, stages, deals' }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
