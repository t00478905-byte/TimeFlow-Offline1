
// بيانات الاتصال بمشروع TimeFlow
const SUPABASE_URL = "https://uaslxojawhkfuaxbcekc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zoQe-zoEhT4YAxpGI1xo5w_NQ_N-SXA";

// إنشاء الاتصال
window.timeFlowSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("TimeFlow Supabase is connected!");

