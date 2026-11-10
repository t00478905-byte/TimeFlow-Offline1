
const supabaseClient = window.timeFlowSupabase;

const authForm = document.getElementById("auth-form");
const authButton = document.getElementById("auth-button");
const switchAuth = document.getElementById("switch-auth");
const authDescription = document.getElementById("auth-description");
const authMessage = document.getElementById("auth-message");

let isSignUp = false;

// عرض الرسائل
function showMessage(message, success = false) {
    authMessage.textContent = message;
    authMessage.style.color = success ? "#55d99a" : "#ff7777";
}

// التبديل بين التسجيل والدخول
switchAuth.addEventListener("click", function () {
    isSignUp = !isSignUp;

    authButton.textContent = isSignUp
        ? "إنشاء حساب جديد"
        : "تسجيل الدخول";

    authDescription.textContent = isSignUp
        ? "أنشئ حسابك وابدأ تنظيم وقتك"
        : "سجّل الدخول لتنظيم وقتك وإنجاز مهامك";

    switchAuth.textContent = isSignUp
        ? "لديك حساب؟ سجّل الدخول"
        : "ليس لديك حساب؟ أنشئ حساباً جديداً";

    document.getElementById("password").autocomplete =
        isSignUp ? "new-password" : "current-password";

    showMessage("");
});

// التسجيل أو تسجيل الدخول
authForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!supabaseClient) {
        showMessage("تعذر الاتصال بقاعدة البيانات.");
        return;
    }

    authButton.disabled = true;
    authButton.textContent = "يرجى الانتظار...";

    try {
        if (isSignUp) {
            const { data, error } =
                await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });

            if (error) throw error;

            if (data.session) {
                showMessage("تم إنشاء الحساب بنجاح!", true);
                window.location.href = "index.html";
            } else {
                showMessage(
                    "تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيد الحساب.",
                    true
                );
            }

        } else {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            showMessage("تم تسجيل الدخول بنجاح!", true);
            window.location.href = "index.html";
        }

    } catch (error) {
        showMessage(error.message);
    } finally {
        authButton.disabled = false;
        authButton.textContent = isSignUp
            ? "إنشاء حساب جديد"
            : "تسجيل الدخول";
    }
});

// إذا كان المستخدم مسجل الدخول مسبقاً
async function checkExistingSession() {
    if (!supabaseClient) return;

    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        window.location.href = "index.html";
    }
}

checkExistingSession();

