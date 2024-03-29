const wildWestQuotes = [
    "There seems to be no crime in this game, what an disappointment",
    "No bounties on the horizon, just tumbleweeds rollin' through the quiet town.",
    "When the sun sets and the wanted posters stay empty, it's a peaceful evening in the Wild West.",
    "In this town, the only thing rustlin' is the wind through the canyon, no outlaws in sight.",
    "Sheriff's sittin' easy, no bounties to chase, just the calm before the storm.",
    "A quiet day on the frontier, where even the cacti ain't hidin' from the law.",
    "No wanted men today, just the sun settlin' down over the silent saloon.",
    "The dusty streets whisper, 'No trouble today,' as the tumbleweeds drift by.",
    "Sheriff's office closed, no bounties to claim; must be a day off for the outlaws.",
    "Not a soul causin' trouble, just the sun painting the sky in hues of peace.",
    "In a town without bounties, even the poker game feels like a friendly chat on the porch.",
    "Cheaters will be terminated and exiled from our lands and event's for all of eternity"
];

// Function to get a random quote
function getRandomQuote() {
    const randomIndex = Math.floor(Math.random() * wildWestQuotes.length);
    return wildWestQuotes[randomIndex];
}

// Update the HTML with a random quote
document.getElementById("wildWestQuote").textContent = getRandomQuote();
