document.addEventListener("DOMContentLoaded", function() {
    const checkInterval = 5000;
    let queueId = 450;
    let scriptEnabled = true;
    let useClientInGame = false;

    const queueMapping = {
        "Aram": 450,
        "Draft Pick": 400,
        "Ranked solo/duo": 420,
        "Ranked flex": 440,
        "Quickplay": 490,
        "Swarm": 1820,
        "Arena": 1700,
        "TFT Normal": 2200,
        "TFT Ranked": 1100,
        "TFT Double up": 1160,
        "TFT hyper roll": 1130
    };

    function getSocialContainer() {
        return document.querySelector("lol-social-roster.roster");
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        document.body.appendChild(toast);

        toast.style.position = 'fixed';
        toast.style.top = '11.5%';
        toast.style.right = '0%';
        toast.style.backgroundColor = '#41FDFE';
        toast.style.color = '#000000';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        toast.style.zIndex = '1000';

        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    }

    window.addEventListener("load", async () => {
        let socialContainer = getSocialContainer();

        while (!socialContainer) {
            await sleep(200); 
            socialContainer = getSocialContainer();
        }

        if (socialContainer) {
            const dropdown = document.createElement("lol-uikit-framed-dropdown");
            dropdown.id = 'queueDropdown';
            dropdown.setAttribute("label", "Select Queue");

            for (const [name, id] of Object.entries(queueMapping)) {
                const option = document.createElement("lol-uikit-dropdown-option");
                option.setAttribute("slot", "lol-uikit-dropdown-option");
                option.setAttribute("value", id);
                option.textContent = name;
                dropdown.appendChild(option);

                option.addEventListener("click", () => {
                    queueId = id;
                    console.log(`Selected queue: ${name}, ID: ${queueId}`);
                });
            }

            socialContainer.appendChild(dropdown);

            const checkboxesContainer = document.createElement("div");
            checkboxesContainer.classList.add("checkboxes-container");

            const enableScriptCheckbox = document.createElement("lol-uikit-radio-input-option");
            enableScriptCheckbox.classList.add("lol-settings-voice-input-mode-option");
            enableScriptCheckbox.textContent = "Enable/Disable Auto Queue";
            enableScriptCheckbox.setAttribute("slot", "lol-uikit-radio-input-option");
            enableScriptCheckbox.toggleAttribute("selected", scriptEnabled);
            enableScriptCheckbox.addEventListener("click", () => {
                scriptEnabled = !scriptEnabled;
                enableScriptCheckbox.toggleAttribute("selected", scriptEnabled);
                console.log(`Script enabled: ${scriptEnabled}`);
                showToast(`Auto Queue ${scriptEnabled ? 'enabled' : 'disabled'}`);
            });

            const useClientInGameCheckbox = document.createElement("lol-uikit-radio-input-option");
            useClientInGameCheckbox.classList.add("lol-settings-voice-input-mode-option");
            useClientInGameCheckbox.textContent = "Use Client In Game";
            useClientInGameCheckbox.setAttribute("slot", "lol-uikit-radio-input-option");
            useClientInGameCheckbox.toggleAttribute("selected", useClientInGame);
            useClientInGameCheckbox.addEventListener("click", () => {
                useClientInGame = !useClientInGame;
                useClientInGameCheckbox.toggleAttribute("selected", useClientInGame);
                console.log(`Use client in game: ${useClientInGame}`);
                showToast(`use Client ingame (Auto Q idle) ${useClientInGame ? 'enabled' : 'disabled'}`);
            });

            checkboxesContainer.appendChild(enableScriptCheckbox);
            checkboxesContainer.appendChild(useClientInGameCheckbox);

            socialContainer.appendChild(checkboxesContainer);
        } else {
            console.error('Social container not found.');
        }
    });

    async function cancelselect() {
        try {
            const response = await fetch("/lol-lobby/v1/lobby/custom/cancel-champ-select", {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log("API call to cancel select was successful.");
        } catch (error) {
            console.error("Error during API call:", error);
        }
    }

    async function checkMatchmakingState() {
        try {
            const response = await fetch("/lol-lobby/v2/lobby/matchmaking/search-state", {
                method: "GET"
            });
            if (response.status === 200) {
                const data = await response.json();
                console.log("Matchmaking state:", data);
                return data;
            } else {
                console.error(`Unexpected response status: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error("Error checking matchmaking state:", error);
            return null;
        }
    }

    async function joinLobby() {
        try {
            const response = await fetch("/lol-lobby/v2/lobby", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ queueId })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log("Joined lobby successfully.");
        } catch (error) {
            console.error("Error joining lobby:", error);
        }
    }

    async function startMatchmaking() {
        try {
            if (!scriptEnabled) {
                return;
            }
            const response = await fetch("/lol-lobby/v2/lobby/matchmaking/search", {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log("Started matchmaking successfully.");
            return true;
        } catch (error) {
            console.error("Error starting matchmaking:", error);
            return false;
        }
    }

    async function checkForGameInProgress() {
        if (!scriptEnabled) {
            return;
        }

        const gameInProgressElement = document.querySelector('.game-in-progress-container');

        if (gameInProgressElement) {
            console.log("Game in progress container found.");
            await cancelselect();

            if (useClientInGame) {
                return;
            }
            
            const gameSessionCheckIntervalId = setInterval(async () => {
                const matchmakingState = await checkMatchmakingState();
                if (matchmakingState && matchmakingState.errors.length === 0 && matchmakingState.searchState === "Invalid") {
                    clearInterval(gameSessionCheckIntervalId);
                    await joinLobby();

                    // Start attempting to start matchmaking every 5 seconds until successful (need better way to determine wether a game has ended or not)
                    const matchmakingCheckIntervalId = setInterval(async () => {
                        const matchmakingStarted = await startMatchmaking();
                        if (!scriptEnabled) {
                            return;
                        }
                        if (matchmakingStarted) {
                            clearInterval(matchmakingCheckIntervalId);
                        } else {
                            console.log("Retrying to start matchmaking...");
                        }
                    }, 3000);
                } else {
                    console.log("Matchmaking state not ready yet. Waiting...");
                }
            }, checkInterval);
        }
    }

    setInterval(checkForGameInProgress, checkInterval);

    // remove "unable to queue error screen"
    const errorCheckInterval = 1000;

    let styleElement = null;

    function checkForError() {
        if (!scriptEnabled) {
            return;
        }

        const dialogLargeElement = document.querySelector('.parties-queue-error-content');

        if (dialogLargeElement && !styleElement) {
            styleElement = document.createElement('style');
            styleElement.appendChild(document.createTextNode(`
                .modal { display: none !important }
            `));
            console.log("Removed queue error screen");
            document.body.appendChild(styleElement);
        } else if (!dialogLargeElement && styleElement) {
            styleElement.parentNode.removeChild(styleElement);
            console.log("Stopped hiding modal");
            styleElement = null;
        }
    }

    setInterval(checkForError, errorCheckInterval);
});
