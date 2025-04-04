const apiKey = "da1582d9e132b07e3885c0c24ce41ecc";

async function getWeather() {
    const city = document.getElementById('city').value.trim();
    if (!city) {
        alert("Please enter a city name!");
        return;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("City not found! Please try again.");
        }

        const data = await response.json();
        displayWeather(data);
    } catch (error) {
        document.getElementById('weather').innerHTML = `
            <p style="color: red;">${error.message}</p>
        `;
    }
}

function displayWeather(data) {
    const weatherDiv = document.getElementById('weather');
    const tempCelsius = data.main.temp.toFixed(1);
    const weatherCondition = data.weather[0].description;
    const weatherIcon = `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

    // Change background dynamically based on weather condition
    document.body.style.background = getBackgroundByWeather(data.weather[0].main);

    const weatherHTML = `
        <img src="${weatherIcon}" alt="Weather Icon">
        <h2>${data.name}</h2>
        <p><strong>${weatherCondition.toUpperCase()}</strong></p>
        <p><strong>Temperature:</strong> ${tempCelsius}°C</p>
        <p><strong>Humidity:</strong> ${data.main.humidity}%</p>
        <p><strong>Wind Speed:</strong> ${data.wind.speed} m/s</p>
    `;
    weatherDiv.innerHTML = weatherHTML;
}

function getBackgroundByWeather(weather) {
    switch (weather.toLowerCase()) {
        case "clear":
            return "linear-gradient(to right, #4facfe, #00f2fe)";
        case "clouds":
            return "linear-gradient(to right, #bdc3c7, #2c3e50)";
        case "rain":
            return "linear-gradient(to right, #00c6ff, #0072ff)";
        case "thunderstorm":
            return "linear-gradient(to right, #373b44, #4286f4)";
        case "snow":
            return "linear-gradient(to right, #e6dada, #274046)";
        default:
            return "linear-gradient(to right, #6dd5ed, #2193b0)";
    }
}