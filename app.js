const ctx = document.getElementById('predictionChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: playerData.map(player => player.name),
        datasets: [{
            label: 'Win Probability',
            data: playerData.map(player => player.winProbability),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
        }]
    }
});
