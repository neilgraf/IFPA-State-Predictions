const ctx = document.getElementById('predictionChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Neil Graf', 'Nathan Zalewski', 'Kassidy Milanowski', 'David Daluga', 'Steven Bowden', 'Timothy Enders', 'Drew Geigel', 'Ryan Eggers', 'Erik Thoren', 'Tom Graf', 'Eric Strangeway', 'Ryan Spindler', 'Mike Weyenberg', 'Danny Bronny', 'Erik Rentmeester', 'Matt McCarty', 'Tom Schmidt', 'Holden Milanowski', 'Trae Vance', 'Joe Decleene', 'Peter Goeben', 'Gerald Morrison', 'Chuck Blohm', 'Adam VanDynHoven'],
        datasets: [{
            label: 'Win Probability',
            data: [44.85, 18.94, 6.63, 5.30, 4.88, 4.19, 3.47, 3.01, 2.52, 2.14, 1.13, 0.89, 0.68, 0.58, 0.24, 0.19, 0.17, 0.09, 0.07, 0.02, 0.01, 0.01, 0.01, 0.01], 
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
        }]
    }
});
