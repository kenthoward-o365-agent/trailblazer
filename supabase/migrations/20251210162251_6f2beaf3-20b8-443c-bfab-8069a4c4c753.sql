-- Create a function to execute read-only queries safely
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  query_lower text;
BEGIN
  -- Validate query is read-only
  query_lower := lower(trim(query_text));
  
  IF NOT query_lower LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF query_lower LIKE '%insert%' OR 
     query_lower LIKE '%update%' OR 
     query_lower LIKE '%delete%' OR 
     query_lower LIKE '%drop%' OR 
     query_lower LIKE '%alter%' OR 
     query_lower LIKE '%truncate%' OR
     query_lower LIKE '%create%' OR
     query_lower LIKE '%grant%' OR
     query_lower LIKE '%revoke%' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;
  
  -- Execute the query and return results as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;