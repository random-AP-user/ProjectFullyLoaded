const publicVapidKey ="BGp4-eK5kP2NBIrp3hlfU-Z4QLv4yoX4zWxMN4P3ZhuHn93nF52RGQtCmhl5Xu2whruRb5sQGaNH8OGnxqkVcuk";
Notification.requestPermission()

function showNotification() {
    const options = {
        title: "This is a notification message.",
        body: "if you get this message you are ready to hunt.",
        icon: "https://www.airsoft-united.com/sites/default/files/pictures/picture-421-1626553238.png",
    };

    const notification = new Notification("Fully loaded airsoft", options);
}

if ('serviceWorker' in navigator) {
    if(Notification.permission === "granted"){
    } else if(Notification.permission !== "denied"){
        subscribeToPush().catch();
    }
}

async function subscribeToPush() {
    console.log("Registering service worker...");
    const register = await navigator.serviceWorker.register("/worker.js", {
        scope: "/"
    });
    console.log("Service Worker Registered...");

    console.log("Registering Push...");
    const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });
    console.log("Push Registered...");

    console.log("Subscribing for Push ...");
    await fetch("/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: {
            "Content-Type":"application/json"
        }
    });
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

document.getElementById("notifyButton").addEventListener("click", () => {
    showNotification();
});


