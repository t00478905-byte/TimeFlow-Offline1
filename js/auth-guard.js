
const client = window.timeFlowSupabase;

async function protectTimeFlow() {
    if (!client) {
        window.location.replace("login.html");
        return;
    }

    const { data, error } = await client.auth.getSession();

    if (error || !data.session) {
        window.location.replace("login.html");
        return;
    }

    // حفظ بيانات المستخدم الحالي
    window.timeFlowUser = data.session.user;

    // زر تسجيل الخروج
    const logoutButton = document.getElementById("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", async function () {
            const { error } = await client.auth.signOut();

            if (error) {
                alert("تعذر تسجيل الخروج. حاول مرة أخرى.");
                return;
            }

            window.location.replace("login.html");
        });
    }

    // تشغيل الموقع بعد التأكد من تسجيل الدخول
    const appScript = document.createElement("script");
    appScript.src = "js/app.js";
    document.body.appendChild(appScript);
}

protectTimeFlow();

