document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFile');
    const processBtn = document.getElementById('processBtn');
    let workoutData = [];

    // Add chart instances at the top of the file
    let workoutTypeChart = null;
    let timeDistributionChart = null;
    let instructorChart = null;

    // Enable process button when file is selected
    csvFileInput.addEventListener('change', (e) => {
        console.log('File selected:', e.target.files); // Debug log
        processBtn.disabled = !e.target.files || e.target.files.length === 0;
    });

    // Process the CSV file when button is clicked
    processBtn.addEventListener('click', () => {
        const file = csvFileInput.files[0];
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                workoutData = results.data;
                createVisualizations(workoutData);
                displayPRs(workoutData);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file. Please check the file format.');
            }
        });
    });

    function createVisualizations(data) {
        // Filter out any empty rows
        const validData = data.filter(row => row['Workout Timestamp']);

        // Create workout type distribution chart
        const workoutTypeData = getWorkoutTypeDistribution(validData);
        workoutTypeChart = createPieChart('workoutTypeChart', 'Workout Type Distribution', workoutTypeData);

        // Create time distribution chart
        const timeData = getTimeDistribution(validData);
        timeDistributionChart = createBarChart('timeDistributionChart', 'Workout Time Distribution', timeData);

        // Create instructor distribution chart
        const instructorData = getInstructorDistribution(validData);
        instructorChart = createBarChart('instructorChart', 'Top Instructors', instructorData);
    }

    // PR navigation state
    let currentPRIndex = 0;
    let currentRideType = 'regular';
    let currentDuration = 5;
    let regularPRs = {};
    let laneBreakPRs = {};

    function displayPRs(data) {
        // Filter for cycling workouts with output data, excluding Just Ride
        const cyclingWorkouts = data.filter(row => {
            // Skip if any required fields are missing
            if (!row['Fitness Discipline'] || !row['Total Output'] || !row['Length (minutes)']) {
                return false;
            }

            // Must be a cycling workout
            if (row['Fitness Discipline'] !== 'Cycling') {
                return false;
            }

            // Must have a valid length (greater than 0)
            const length = parseInt(row['Length (minutes)']);
            if (isNaN(length) || length <= 0) {
                return false;
            }

            // Must not be a Just Ride (checking for various formats)
            const type = (row['Type'] || '').toLowerCase();
            const title = (row['Title'] || '').toLowerCase();
            
            // Check if it's a Just Ride in either the Type or Title field
            const isJustRide = type.includes('just') || title.includes('just ride');
            
            return !isJustRide;
        });

        // Separate regular rides and LaneBreak rides
        const regularRides = cyclingWorkouts.filter(row => 
            !(row['Title'] || '').toLowerCase().includes('lanebreak')
        );
        const laneBreakRides = cyclingWorkouts.filter(row => 
            (row['Title'] || '').toLowerCase().includes('lanebreak')
        );

        // Find PRs for each length and organize by duration
        regularPRs = findPRsByLength(regularRides);
        laneBreakPRs = findPRsByLength(laneBreakRides);

        // Initialize navigation
        currentPRIndex = 0;
        currentRideType = 'regular';
        currentDuration = 5;
        updatePRCard();
        setupNavigation();
        setupTabs();

        // Update fun stats
        updateFunStats(cyclingWorkouts);
    }

    function setupTabs() {
        // Setup ride type tabs
        const rideTypeTabs = document.querySelectorAll('.pr-tab');
        rideTypeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                rideTypeTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update current ride type and reset index
                currentRideType = tab.dataset.type;
                currentPRIndex = 0;
                
                // Update the card
                updatePRCard();
            });
        });

        // Setup duration tabs
        const durationTabs = document.querySelectorAll('.duration-tab');
        durationTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                durationTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update current duration and reset index
                currentDuration = parseInt(tab.dataset.duration);
                currentPRIndex = 0;
                
                // Update the card
                updatePRCard();
            });
        });
    }

    function parsePelotonDate(dateStr) {
        if (!dateStr) return null;
        
        // Extract the date and time parts
        const match = dateStr.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \(([+-]\d{2})\)$/);
        if (!match) return null;
        
        const [_, datetime, offset] = match;
        // Create a date string in ISO format with the timezone offset
        const isoDate = `${datetime}:00${offset}:00`;
        return new Date(isoDate);
    }

    function findPRsByLength(workouts) {
        const prs = {};
        workouts.forEach(workout => {
            const length = parseInt(workout['Length (minutes)']);
            const output = parseFloat(workout['Total Output']);
            
            if (!prs[length]) {
                prs[length] = [];
            }
            
            prs[length].push({
                length: length,
                output: output,
                date: workout['Class Timestamp'],
                workoutDate: workout['Workout Timestamp'],
                instructor: workout['Instructor Name'],
                type: workout['Type'],
                avgWatts: workout['Avg. Watts'],
                avgResistance: workout['Avg. Resistance'],
                avgCadence: workout['Avg. Cadence (RPM)'],
                avgSpeed: workout['Avg. Speed (kph)'],
                distance: workout['Distance (km)'],
                calories: workout['Calories Burned'],
                avgHeartrate: workout['Avg. Heartrate']
            });
        });

        // For each duration, find the actual PR progression
        Object.keys(prs).forEach(duration => {
            // Sort by date
            prs[duration].sort((a, b) => {
                const dateA = parsePelotonDate(a.date);
                const dateB = parsePelotonDate(b.date);
                return dateA - dateB;
            });
            
            // Find PR progression
            let currentPR = 0;
            const prProgression = [];
            
            prs[duration].forEach(workout => {
                if (workout.output > currentPR) {
                    prProgression.push(workout);
                    currentPR = workout.output;
                }
            });
            
            // Reverse the order so most recent PR is first
            prs[duration] = prProgression.reverse();
        });

        return prs;
    }

    function updatePRCard() {
        const currentPRs = (currentRideType === 'regular' ? regularPRs : laneBreakPRs)[currentDuration] || [];
        
        if (currentPRs.length === 0) {
            document.getElementById('prTitle').textContent = `No ${currentRideType === 'regular' ? 'Regular' : 'LaneBreak'} ${currentDuration} min PRs found`;
            document.getElementById('prClassDate').textContent = '';
            document.getElementById('prWorkoutDate').textContent = '';
            document.getElementById('prProgression').textContent = '';
            document.getElementById('prInstructor').textContent = '';
            document.getElementById('prOutput').textContent = '';
            document.getElementById('prWatts').textContent = '';
            document.getElementById('prResistance').textContent = '';
            document.getElementById('prCadence').textContent = '';
            document.getElementById('prSpeed').textContent = '';
            document.getElementById('prDistance').textContent = '';
            document.getElementById('prCalories').textContent = '';
            document.getElementById('prHeartrate').textContent = '';
            return;
        }

        const pr = currentPRs[currentPRIndex];
        console.log('PR data:', pr); // Debug log
        const classDate = parsePelotonDate(pr.date);
        const workoutDate = parsePelotonDate(pr.workoutDate);
        
        let formattedClassDate = 'Date not available';
        let formattedWorkoutDate = 'Date not available';
        
        if (classDate) {
            formattedClassDate = classDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        if (workoutDate) {
            formattedWorkoutDate = workoutDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Update card content
        document.getElementById('prTitle').textContent = `${pr.length} Minute ${pr.type}`;
        document.getElementById('prClassDate').textContent = formattedClassDate;
        document.getElementById('prWorkoutDate').textContent = formattedWorkoutDate;
        document.getElementById('prInstructor').textContent = pr.instructor;
        document.getElementById('prOutput').textContent = `${pr.output} kJ`;
        document.getElementById('prWatts').textContent = `${pr.avgWatts || '-'} W`;
        document.getElementById('prResistance').textContent = `${pr.avgResistance || '-'}`;
        document.getElementById('prCadence').textContent = `${pr.avgCadence || '-'} RPM`;
        document.getElementById('prSpeed').textContent = `${pr.avgSpeed || '-'} kph`;
        document.getElementById('prDistance').textContent = `${pr.distance || '-'} km`;
        document.getElementById('prCalories').textContent = `${pr.calories || '-'}`;
        document.getElementById('prHeartrate').textContent = `${pr.avgHeartrate || '-'} bpm`;

        // Update navigation buttons
        const prevButton = document.getElementById('prevPR');
        const nextButton = document.getElementById('nextPR');
        
        prevButton.disabled = currentPRIndex === currentPRs.length - 1;
        nextButton.disabled = currentPRIndex === 0;

        // Add PR progression information
        const nextPR = currentPRIndex > 0 ? currentPRs[currentPRIndex - 1] : null;
        const outputDiff = nextPR ? nextPR.output - pr.output : 0;
        
        // Update the navigation text to show PR progression
        const navText = document.getElementById('prProgression');
        if (nextPR) {
            navText.textContent = `Beaten by ${outputDiff.toFixed(1)} kJ`;
        } else {
            navText.textContent = 'Latest PR!';
        }
    }

    function setupNavigation() {
        document.getElementById('prevPR').addEventListener('click', () => {
            const currentPRs = (currentRideType === 'regular' ? regularPRs : laneBreakPRs)[currentDuration] || [];
            if (currentPRIndex < currentPRs.length - 1) {
                currentPRIndex++;
                updatePRCard();
            }
        });

        document.getElementById('nextPR').addEventListener('click', () => {
            const currentPRs = (currentRideType === 'regular' ? regularPRs : laneBreakPRs)[currentDuration] || [];
            if (currentPRIndex > 0) {
                currentPRIndex--;
                updatePRCard();
            }
        });
    }

    function getWorkoutTypeDistribution(data) {
        const typeCount = {};
        data.forEach(row => {
            const type = row['Fitness Discipline'] || 'Unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        return {
            labels: Object.keys(typeCount),
            data: Object.values(typeCount)
        };
    }

    function getTimeDistribution(data) {
        const timeCount = {};
        data.forEach(row => {
            const time = row['Length (minutes)'];
            if (time) {
                timeCount[time] = (timeCount[time] || 0) + 1;
            }
        });

        return {
            labels: Object.keys(timeCount).map(t => `${t} min`),
            data: Object.values(timeCount)
        };
    }

    function getInstructorDistribution(data) {
        const instructorCount = {};
        data.forEach(row => {
            const instructor = row['Instructor Name'] || 'Unknown';
            instructorCount[instructor] = (instructorCount[instructor] || 0) + 1;
        });

        // Sort by count and take top 10
        const sorted = Object.entries(instructorCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            labels: sorted.map(item => item[0]),
            data: sorted.map(item => item[1])
        };
    }

    function createPieChart(canvasId, title, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: [
                        '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
                        '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: title
                    }
                }
            }
        });
    }

    function createBarChart(canvasId, title, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Number of Workouts',
                    data: data.data,
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: title
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function getPRProgression(workouts) {
        // Sort workouts by date
        const sortedWorkouts = workouts.sort((a, b) => 
            new Date(a['Workout Timestamp']) - new Date(b['Workout Timestamp'])
        );

        // Group by length and track PRs over time
        const progressionByLength = {};
        
        sortedWorkouts.forEach(workout => {
            const length = workout['Length (minutes)'];
            const date = new Date(workout['Workout Timestamp']);
            const output = parseFloat(workout['Total Output']);

            if (!progressionByLength[length]) {
                progressionByLength[length] = {
                    dates: [],
                    outputs: [],
                    currentPR: 0
                };
            }

            if (output > progressionByLength[length].currentPR) {
                progressionByLength[length].dates.push(date);
                progressionByLength[length].outputs.push(output);
                progressionByLength[length].currentPR = output;
            }
        });

        return progressionByLength;
    }

    function createPRProgressionChart(canvasId, progressionData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // Prepare datasets for each length
        const datasets = Object.entries(progressionData).map(([length, data], index) => {
            const colors = [
                '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
                '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
            ];
            
            return {
                label: `${length} min`,
                data: data.outputs,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length],
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: false
            };
        });

        // Get all unique dates from all datasets
        const allDates = new Set();
        Object.values(progressionData).forEach(data => {
            data.dates.forEach(date => allDates.add(date));
        });
        
        // Sort dates and format them
        const sortedDates = Array.from(allDates).sort((a, b) => a - b);
        const formattedDates = sortedDates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: datasets
            },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'PR Progression Over Time'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} kJ`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Output (kJ)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function updateFunStats(workouts) {
        // Constants for comparisons
        const BIG_MAC_CALORIES = 550; // calories in a Big Mac
        const TV_CALORIES_PER_HOUR = 100; // approximate calories burned watching TV
        const EARTH_CIRCUMFERENCE = 40075; // km around the equator
        const MOON_DISTANCE = 384400; // km to the moon
        const CAR_ENGINE_POWER = 100; // kW (average car engine power)
        const LIGHT_BULB_POWER = 0.06; // kW (60W light bulb)

        // Calculate totals
        const totalCalories = workouts.reduce((sum, workout) => sum + (parseFloat(workout['Calories Burned']) || 0), 0);
        const totalDistance = workouts.reduce((sum, workout) => sum + (parseFloat(workout['Distance (km)']) || 0), 0);
        const totalOutput = workouts.reduce((sum, workout) => sum + (parseFloat(workout['Total Output']) || 0), 0);

        // Update calorie comparisons
        document.getElementById('totalCalories').textContent = `${totalCalories.toLocaleString()} calories`;
        document.getElementById('bigMacs').textContent = `${(totalCalories / BIG_MAC_CALORIES).toFixed(1)}`;
        document.getElementById('tvHours').textContent = `${(totalCalories / TV_CALORIES_PER_HOUR).toFixed(1)}`;

        // Update distance comparisons
        document.getElementById('totalDistance').textContent = `${totalDistance.toLocaleString()} km`;
        document.getElementById('aroundWorld').textContent = `${((totalDistance / EARTH_CIRCUMFERENCE) * 100).toFixed(2)}%`;
        document.getElementById('toMoon').textContent = `${((totalDistance / MOON_DISTANCE) * 100).toFixed(4)}%`;

        // Update output comparisons
        document.getElementById('totalOutput').textContent = `${totalOutput.toLocaleString()} kJ`;
        document.getElementById('carEngine').textContent = `${(totalOutput / (CAR_ENGINE_POWER * 3600)).toFixed(1)}x`;
        document.getElementById('lightBulb').textContent = `${(totalOutput / (LIGHT_BULB_POWER * 86400)).toFixed(1)}x`;
    }

    function resetApplication() {
        // Reset charts
        if (workoutTypeChart) {
            workoutTypeChart.destroy();
            workoutTypeChart = null;
        }
        if (timeDistributionChart) {
            timeDistributionChart.destroy();
            timeDistributionChart = null;
        }
        if (instructorChart) {
            instructorChart.destroy();
            instructorChart = null;
        }

        // Clear workout data
        workoutData = [];
        regularPRs = {};
        laneBreakPRs = {};
        currentPRIndex = 0;
        currentRideType = 'regular';
        currentDuration = 5;

        // Reset UI elements
        document.getElementById('workoutTypeChart').innerHTML = '';
        document.getElementById('timeDistributionChart').innerHTML = '';
        document.getElementById('instructorChart').innerHTML = '';
        document.getElementById('prTitle').textContent = 'Select a ride type and duration';
        document.getElementById('prClassDate').textContent = '';
        document.getElementById('prWorkoutDate').textContent = '';
        document.getElementById('prProgression').textContent = '';
        document.getElementById('prInstructor').textContent = '';
        document.getElementById('prOutput').textContent = '';
        document.getElementById('prWatts').textContent = '';
        document.getElementById('prResistance').textContent = '';
        document.getElementById('prCadence').textContent = '';
        document.getElementById('prSpeed').textContent = '';
        document.getElementById('prDistance').textContent = '';
        document.getElementById('prCalories').textContent = '';
        document.getElementById('prHeartrate').textContent = '';

        // Reset fun stats
        document.getElementById('totalCalories').textContent = '0';
        document.getElementById('bigMacs').textContent = '0';
        document.getElementById('tvHours').textContent = '0';
        document.getElementById('totalDistance').textContent = '0 km';
        document.getElementById('aroundWorld').textContent = '0%';
        document.getElementById('toMoon').textContent = '0%';
        document.getElementById('totalOutput').textContent = '0 kJ';
        document.getElementById('carEngine').textContent = '0x';
        document.getElementById('lightBulb').textContent = '0x';

        // Reset navigation buttons
        document.getElementById('prevPR').disabled = true;
        document.getElementById('nextPR').disabled = true;
    }

    // Update the file input change handler
    document.getElementById('csvFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Reset the application state
            resetApplication();
            
            Papa.parse(file, {
                header: true,
                complete: function(results) {
                    workoutData = results.data;
                    createVisualizations(workoutData);
                    displayPRs(workoutData);
                }
            });
        }
    });

    // Add process button click handler
    document.getElementById('processBtn').addEventListener('click', function() {
        const file = document.getElementById('csvFile').files[0];
        if (file) {
            // Reset the application state
            resetApplication();
            
            Papa.parse(file, {
                header: true,
                complete: function(results) {
                    workoutData = results.data;
                    createVisualizations(workoutData);
                    displayPRs(workoutData);
                }
            });
        } else {
            alert('Please select a CSV file first');
        }
    });
}); 