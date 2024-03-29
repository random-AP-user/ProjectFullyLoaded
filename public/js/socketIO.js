const socket = io();
socket.on("bountyUpdate", () => {
fetch("/getUpdatedBounties")
    .then(response => response.json())
    .then(data => {
        updateBountyContainer(data.updatedBountyContent);
    })
    .catch(error => console.error('Error fetching updated bounty data:', error));
});
function updateBountyContainer(updatedBounties) {
const bountyContainer = document.getElementById("bountyContainer");

bountyContainer.innerHTML = "";
if(updatedBounties[0] == undefined){
    const newUserDiv = document.createElement("div");
    bountyContainer.innerHTML = `
    <div style="display: grid; grid-column: 1/4; min-height: 40vh; place-items: center; text-align: center;">
        <h2 id="wildWestQuote"></h2>
    </div>`                    
    document.getElementById("wildWestQuote").textContent = getRandomQuote();
} else{
    updatedBounties.forEach(user => {
        const newUserDiv = document.createElement("div");

        newUserDiv.innerHTML = `
            <form action="/claim" method="post">
                <div>
                    <img src="images/${user.image}" alt="Wanted Person">
                    <br>
                    <br>
                    <h3>${user.username}</h3>
                    <p>৳${user.price}</p>
                    <button class="bountytd link" href="">Claim Bounty</button>
                </div>
            </form>`;
    bountyContainer.appendChild(newUserDiv);
});
}
}
socket.on("activeUsers", () => {
fetch("/refreshUsers")
    .then(response => response.json())
    .then(data => {
        updateActiveUsers(data.activeUsers);
    })
    .catch(error => console.error('Error fetching updated bounty data:', error));
});
function updateActiveUsers(activeUsers) {
    const userCountContainer = document.getElementById("userCountContainer");
    userCountContainer.innerHTML = activeUsers;
}