const SUPABASE_URL = 'https://ltqkovxzsuqixryzqpeo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cWtvdnh6c3VxaXhyeXpxcGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzE4MDQsImV4cCI6MjA4ODM0NzgwNH0.ZIrbeU2dABWJVvH7RW1ijamFyXFt3FNxPzugSYHH_g8';

window.supabaseClient = (() => {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  const invalidUrl = SUPABASE_URL.includes('请替换');
  const invalidKey = SUPABASE_ANON_KEY.includes('请替换');
  if (invalidUrl || invalidKey) {
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
