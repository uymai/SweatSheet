document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFile');
    const processBtn = document.getElementById('processBtn');
    let workoutData = [];
    let allWorkouts = [];

    // Add chart instances at the top of the file
    let workoutTypeChart = null;
    let timeDistributionChart = null;
    let instructorChart = null;
    let outputTrendChart = null;

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
                processWorkouts(workoutData);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file. Please check the file format.');
            }
        });
    });

    function processWorkouts(workouts) {
        // Create workout maps and data holders for all our stats
        const data = {
            // Counts and totals
            totalWorkouts: 0,
            totalMinutes: 0,
            totalDistance: 0,
            totalCalories: 0,
            totalOutput: 0,
            
            // Type distribution
            typeCount: {},
            
            // Time distribution
            timeCount: {},
            
            // Instructor stats
            instructorStats: {},
            
            // Workout days for streaks
            workoutDays: new Set(),
            
            // Sorted workouts by date
            sortedWorkouts: [],
            
            // Filter for cycling workouts
            cyclingWorkouts: []
        };
        
        // First pass - filter cycling workouts
        data.cyclingWorkouts = workouts.filter(workout => 
            workout['Fitness Discipline'] === 'Cycling' && workout['Workout Timestamp']
        );
        
        // Sort cycling workouts by date
        data.sortedWorkouts = [...data.cyclingWorkouts].sort((a, b) => 
            new Date(a['Workout Timestamp'].replace(' (EST)', '')) - 
            new Date(b['Workout Timestamp'].replace(' (EST)', ''))
        );
        
        // Second pass - process all workouts for core stats
        workouts.forEach(workout => {
            // Workout type distribution
            const type = workout['Fitness Discipline'] || 'Unknown';
            data.typeCount[type] = (data.typeCount[type] || 0) + 1;
            
            // Time distribution
            const time = workout['Length (minutes)'];
            if (time) {
                data.timeCount[time] = (data.timeCount[time] || 0) + 1;
            }
            
            // Instructor distribution
            const instructor = workout['Instructor Name'] || 'Unknown';
            if (!data.instructorStats[instructor]) {
                data.instructorStats[instructor] = { count: 0, minutes: 0 };
            }
            data.instructorStats[instructor].count++;
        });
        
        // Third pass - process cycling workouts for detailed stats
        data.cyclingWorkouts.forEach(workout => {
            // Basic stats
            data.totalWorkouts++;
            
            // Add workout day for streak calculation
            const workoutDate = new Date(workout['Workout Timestamp'].replace(' (EST)', ''));
            workoutDate.setHours(0, 0, 0, 0);
            data.workoutDays.add(workoutDate.toISOString().split('T')[0]);
            
            // Time stats
            const length = parseInt(workout['Length (minutes)']) || 0;
            data.totalMinutes += length;
            
            // Instructor minutes
            const instructor = workout['Instructor Name'];
            if (instructor && instructor !== '' && data.instructorStats[instructor]) {
                data.instructorStats[instructor].minutes += length;
            }
            
            // Distance stat
            const distance = parseFloat(workout['Distance (km)']) || 0;
            data.totalDistance += distance;
            
            // Calories stat
            const calories = parseFloat(workout['Calories Burned']) || 0;
            data.totalCalories += calories;
            
            // Output stat
            const output = parseFloat(workout['Total Output']) || 0;
            data.totalOutput += output;
        });
        
        // Now update all UI components
        updateAllUI(data);
        displayPRs(workouts);
    }

    function updateAllUI(data) {
        // 1. Update workout type distribution chart
        const workoutTypeData = {
            labels: Object.keys(data.typeCount),
            data: Object.values(data.typeCount)
        };
        workoutTypeChart = createPieChart('workoutTypeChart', 'Workout Type Distribution', workoutTypeData);
        
        // 2. Update time distribution chart
        const timeData = {
            labels: Object.keys(data.timeCount).map(t => `${t} min`),
            data: Object.values(data.timeCount)
        };
        timeDistributionChart = createBarChart('timeDistributionChart', 'Workout Time Distribution', timeData);
        
        // 3. Update instructor chart
        const sortedInstructors = Object.entries(data.instructorStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10);
        
        const instructorData = {
            labels: sortedInstructors.map(item => item[0]),
            data: sortedInstructors.map(item => item[1].count)
        };
        instructorChart = createBarChart('instructorChart', 'Top Instructors', instructorData);
        
        // 4. Update fun stats
        updateFunStatsUI(data);
        
        // 5. Update stats stats
        updateStatsStatsUI(data);
        
        // 6. Update performance trends
        // Pass all workouts if no cycling workouts are found
        if (data.cyclingWorkouts && data.cyclingWorkouts.length > 0) {
            updatePerformanceTrends(data.cyclingWorkouts);
        } else {
            console.log("No cycling workouts found, using all workouts for performance trends");
            updatePerformanceTrends(allWorkouts);
        }
        
        // 7. Update streaks
        updateStreaksUI(data);
    }

    function updateFunStatsUI(data) {
        // Constants for comparisons
        const BIG_MAC_CALORIES = 550; // calories in a Big Mac
        const TV_CALORIES_PER_HOUR = 100; // approximate calories burned watching TV
        const EARTH_CIRCUMFERENCE = 40075; // km around the equator
        const MOON_DISTANCE = 384400; // km to the moon
        const CAR_ENGINE_POWER = 100; // kW (average car engine power)
        const LIGHT_BULB_POWER = 0.06; // kW (60W light bulb)

        // Update calorie comparisons
        document.getElementById('totalCalories').textContent = `${data.totalCalories.toLocaleString()} calories`;
        document.getElementById('bigMacs').textContent = `${(data.totalCalories / BIG_MAC_CALORIES).toFixed(1)}`;
        document.getElementById('tvHours').textContent = `${(data.totalCalories / TV_CALORIES_PER_HOUR).toFixed(1)}`;

        // Update distance comparisons
        document.getElementById('totalDistance').textContent = `${data.totalDistance.toLocaleString()} km`;
        document.getElementById('aroundWorld').textContent = `${((data.totalDistance / EARTH_CIRCUMFERENCE) * 100).toFixed(2)}%`;
        document.getElementById('toMoon').textContent = `${((data.totalDistance / MOON_DISTANCE) * 100).toFixed(4)}%`;

        // Update output comparisons
        document.getElementById('totalOutput').textContent = `${data.totalOutput.toLocaleString()} kJ`;
        document.getElementById('carEngine').textContent = `${(data.totalOutput / (CAR_ENGINE_POWER * 3600)).toFixed(1)}x`;
        document.getElementById('lightBulb').textContent = `${(data.totalOutput / (LIGHT_BULB_POWER * 86400)).toFixed(1)}x`;
    }

    function updateStatsStatsUI(data) {
        // Total workouts (all types)
        document.getElementById('totalWorkouts').textContent = data.totalWorkouts;

        // Cycling workout count
        const cyclingCount = data.cyclingWorkouts.length;
        document.getElementById('cyclingWorkouts').textContent = cyclingCount;
        
        // Cycling percentage
        const cyclingPercentage = data.totalWorkouts > 0 ? 
            ((cyclingCount / data.totalWorkouts) * 100).toFixed(1) : 0;
        document.getElementById('cyclingPercentage').textContent = `${cyclingPercentage}%`;

        // Total time spent and average workout length (for cycling workouts)
        document.getElementById('totalTimeSpent').textContent = formatTime(data.totalMinutes);
        const avgWorkoutLength = cyclingCount > 0 ? Math.round(data.totalMinutes / cyclingCount) : 0;
        document.getElementById('avgWorkoutLength').textContent = formatTime(avgWorkoutLength);

        // Total distance
        document.getElementById('totalDistanceStats').textContent = `${data.totalDistance.toFixed(1)} km`;

        // Total calories
        document.getElementById('totalCaloriesStats').textContent = data.totalCalories.toLocaleString();

        // Favorite instructor
        let favoriteInstructor = '-';
        let favoriteInstructorTime = 0;
        let maxClasses = 0;
        Object.entries(data.instructorStats).forEach(([instructor, stats]) => {
            if (stats.count > maxClasses) {
                maxClasses = stats.count;
                favoriteInstructor = instructor;
                favoriteInstructorTime = stats.minutes;
            }
        });
        document.getElementById('favoriteInstructor').textContent = favoriteInstructor;
        document.getElementById('favoriteInstructorTime').textContent = formatTime(favoriteInstructorTime);

        // Most frequent workout type
        let mostFrequentWorkout = '-';
        let maxCount = 0;
        Object.entries(data.typeCount).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentWorkout = type;
            }
        });
        document.getElementById('mostFrequentWorkout').textContent = mostFrequentWorkout;
    }

    function calculateLongestStreak(workouts) {
        // Filter for cycling workouts only
        const cyclingWorkouts = workouts.filter(workout => workout['Fitness Discipline'] === 'Cycling');
        
        if (cyclingWorkouts.length === 0) return 0;

        // Process workout dates and deduplicate by day
        const dateSet = new Map();
        cyclingWorkouts.forEach(workout => {
            try {
                // Handle both EST and UTC time formats
                const timestamp = workout['Workout Timestamp'] || '';
                const cleanTimestamp = timestamp
                    .replace(' (EST)', '')
                    .replace(' (UTC)', '');
                    
                const date = new Date(cleanTimestamp);
                
                // Skip invalid dates
                if (isNaN(date.getTime())) return;
                
                // Set to start of day
                date.setHours(0, 0, 0, 0);
                
                // Convert to YYYY-MM-DD format
                const dateStr = date.toISOString().split('T')[0];
                
                // Store date objects in map
                dateSet.set(dateStr, date);
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        });
        
        if (dateSet.size === 0) return 0;
        
        // Convert to array of date objects and sort chronologically
        const sortedDates = Array.from(dateSet.values()).sort((a, b) => a - b);
        
        // Find longest streak of consecutive days
        let currentStreak = 1;
        let maxStreak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
            const current = sortedDates[i];
            const previous = sortedDates[i-1];
            
            // Calculate difference in days
            const diffTime = current - previous;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                // Consecutive day
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else if (diffDays > 1) {
                // Break in streak
                currentStreak = 1;
            }
            // If diffDays is 0 (same day), ignore and continue
        }
        
        return maxStreak;
    }

    function updateStreaksUI(data) {
        // Calculate longest streak
        const longestStreak = calculateLongestStreak(data.cyclingWorkouts);
        document.getElementById('longestStreak').textContent = `${longestStreak} days`;

        // Create workout heatmap
        createWorkoutHeatmap(data.cyclingWorkouts);
    }

    function createWorkoutHeatmap(workouts) {
        const heatmapContainer = document.getElementById('workoutHeatmap');
        heatmapContainer.innerHTML = '';

        // Filter for cycling workouts only
        const cyclingWorkouts = workouts.filter(workout => workout['Fitness Discipline'] === 'Cycling');

        // Get date range (last 12 months)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);

        // Create a map of workout dates
        const workoutDates = new Map();
        cyclingWorkouts.forEach(workout => {
            try {
                // Handle both EST and UTC time formats
                const timestamp = workout['Workout Timestamp'] || '';
                const cleanTimestamp = timestamp
                    .replace(' (EST)', '')
                    .replace(' (UTC)', '');
                    
                const date = new Date(cleanTimestamp);
                
                // Skip invalid dates
                if (isNaN(date.getTime())) return;
                
                // Set to start of day
                date.setHours(0, 0, 0, 0);
                
                // Convert to YYYY-MM-DD format
                const dateStr = date.toISOString().split('T')[0];
                
                // Increment count for this date
                workoutDates.set(dateStr, (workoutDates.get(dateStr) || 0) + 1);
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        });

        // Generate heatmap
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const monthDiv = document.createElement('div');
            monthDiv.className = 'heatmap-month';
            
            const monthLabel = document.createElement('div');
            monthLabel.className = 'heatmap-month-label';
            monthLabel.textContent = currentDate.toLocaleString('default', { month: 'short' });
            monthDiv.appendChild(monthLabel);

            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

            // Add empty days for the first week
            for (let i = 0; i < firstDayOfMonth; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'heatmap-day';
                monthDiv.appendChild(emptyDay);
            }

            // Add days of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dateStr = date.toISOString().split('T')[0];
                const workoutCount = workoutDates.get(dateStr) || 0;

                const dayDiv = document.createElement('div');
                dayDiv.className = 'heatmap-day';
                
                // Set intensity level based on workout count
                if (workoutCount > 0) {
                    const level = Math.min(Math.ceil(workoutCount / 2), 4);
                    dayDiv.setAttribute('data-level', level);
                }

                monthDiv.appendChild(dayDiv);
            }

            heatmapContainer.appendChild(monthDiv);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
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
        if (outputTrendChart) {
            outputTrendChart.destroy();
            outputTrendChart = null;
        }

        // Clear workout data
        workoutData = [];
        allWorkouts = [];
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
            
            // Show loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = 'Processing data...';
            document.querySelector('.container').appendChild(loadingIndicator);
            
            // Use setTimeout to allow the loading indicator to render
            setTimeout(() => {
                Papa.parse(file, {
                    header: true,
                    complete: function(results) {
                        allWorkouts = results.data;
                        
                        // Process workouts once to extract all necessary data
                        const stats = processWorkoutsOnce(allWorkouts);
                        
                        // Update all UI components with the extracted data
                        createVisualizations(allWorkouts, stats);
                        displayPRs(allWorkouts);
                        updatePerformanceTrends(stats.cyclingWorkouts);
                        updateStreaks(stats);
                        
                        // Remove loading indicator
                        document.querySelector('.loading-indicator')?.remove();
                        
                        // Disable the process button since data is already processed
                        const processBtn = document.getElementById('processBtn');
                        processBtn.disabled = true;
                        processBtn.textContent = 'Data Processed';
                    },
                    error: function(error) {
                        console.error('Error parsing CSV:', error);
                        document.querySelector('.loading-indicator')?.remove();
                        alert('Error parsing CSV file. Please check the file format.');
                    }
                });
            }, 50);
        }
    });

    // Set up process button click handler - but it's no longer needed for normal operation
    document.getElementById('processBtn').addEventListener('click', function() {
        if (allWorkouts.length === 0) {
            alert('Please upload a CSV file first.');
            return;
        }
        
        // This is now just a backup in case the user wants to reprocess the same data
        resetApplication();
        
        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = 'Reprocessing data...';
        document.querySelector('.container').appendChild(loadingIndicator);
        
        // Use setTimeout to allow the loading indicator to render
        setTimeout(() => {
            // Process workouts once to extract all necessary data
            const stats = processWorkoutsOnce(allWorkouts);
            
            // Update all UI components with the extracted data
            createVisualizations(allWorkouts, stats);
            displayPRs(allWorkouts);
            updatePerformanceTrends(stats.cyclingWorkouts);
            updateStreaks(stats);
            
            // Remove loading indicator
            document.querySelector('.loading-indicator')?.remove();
        }, 50);
    });

    // Process all workouts in a single pass
    function processWorkoutsOnce(workouts) {
        // Filter out any empty rows or rows with missing timestamps
        const validWorkouts = workouts.filter(workout => workout && workout['Workout Timestamp']);
        
        const stats = {
            // Cycling workouts
            cyclingWorkouts: [],
            
            // General stats
            totalWorkouts: 0,
            totalMinutes: 0,
            totalDistance: 0,
            totalCalories: 0,
            totalOutput: 0,
            
            // Type distribution
            workoutTypes: {},
            
            // Time distribution
            workoutLengths: {},
            
            // Instructor stats
            instructorStats: {},
            
            // Workout days (for streak calculation)
            workoutDays: new Set()
        };
        
        // Count all valid workouts first (regardless of type)
        stats.totalWorkouts = validWorkouts.length;
        
        // Process all workouts for general stats (type, time distribution, instructor)
        validWorkouts.forEach(workout => {
            // Track workout days for streak calculation
            try {
                const timestamp = workout['Workout Timestamp'] || '';
                const cleanTimestamp = timestamp
                    .replace(' (EST)', '')
                    .replace(' (UTC)', '');
                    
                const date = new Date(cleanTimestamp);
                
                // Skip invalid dates
                if (!isNaN(date.getTime())) {
                    date.setHours(0, 0, 0, 0);
                    stats.workoutDays.add(date.toISOString().split('T')[0]);
                }
            } catch (e) {
                console.error('Error parsing date:', e);
            }
            
            // Track workout types
            const type = workout['Fitness Discipline'] || 'Unknown';
            stats.workoutTypes[type] = (stats.workoutTypes[type] || 0) + 1;
            
            // Track workout lengths
            const timeKey = workout['Length (minutes)'];
            if (timeKey) {
                stats.workoutLengths[timeKey] = (stats.workoutLengths[timeKey] || 0) + 1;
            }
            
            // Track instructor stats
            const instructor = workout['Instructor Name'] || 'Unknown';
            if (instructor) {
                if (!stats.instructorStats[instructor]) {
                    stats.instructorStats[instructor] = { count: 0, minutes: 0 };
                }
                stats.instructorStats[instructor].count++;
            }
        });
        
        // Filter for cycling workouts
        stats.cyclingWorkouts = validWorkouts.filter(workout => 
            workout['Fitness Discipline'] === 'Cycling'
        );
        
        console.log(`Found ${validWorkouts.length} valid workouts, ${stats.cyclingWorkouts.length} are cycling workouts`);
        
        // Process cycling workouts for detailed stats
        stats.cyclingWorkouts.forEach(workout => {
            // Accumulate time stats
            const length = parseInt(workout['Length (minutes)']) || 0;
            stats.totalMinutes += length;
            
            // Track instructor minutes
            const instructor = workout['Instructor Name'] || 'Unknown';
            if (instructor && stats.instructorStats[instructor]) {
                stats.instructorStats[instructor].minutes += length;
            }
            
            // Accumulate distance stats
            const distance = parseFloat(workout['Distance (km)']) || 0;
            stats.totalDistance += distance;
            
            // Accumulate calorie stats
            const calories = parseFloat(workout['Calories Burned']) || 0;
            stats.totalCalories += calories;
            
            // Accumulate output stats
            const output = parseFloat(workout['Total Output']) || 0;
            stats.totalOutput += output;
        });
        
        return stats;
    }

    // Update the createVisualizations function to use pre-processed stats
    function createVisualizations(data, stats) {
        // Filter out any empty rows
        const validData = data.filter(row => row['Workout Timestamp']);

        // Create workout type distribution chart
        const workoutTypeData = {
            labels: Object.keys(stats.workoutTypes),
            data: Object.values(stats.workoutTypes)
        };
        workoutTypeChart = createPieChart('workoutTypeChart', 'Workout Type Distribution', workoutTypeData);

        // Create time distribution chart
        const timeData = {
            labels: Object.keys(stats.workoutLengths).map(t => `${t} min`),
            data: Object.values(stats.workoutLengths)
        };
        timeDistributionChart = createBarChart('timeDistributionChart', 'Workout Time Distribution', timeData);

        // Create instructor distribution chart
        const sortedInstructors = Object.entries(stats.instructorStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10);
        
        const instructorData = {
            labels: sortedInstructors.map(item => item[0]),
            data: sortedInstructors.map(item => item[1].count)
        };
        instructorChart = createBarChart('instructorChart', 'Top Instructors', instructorData);

        // Update stats stats
        updateStatsStatsFromStats(stats);
        
        // Update fun stats
        updateFunStatsFromStats(stats);
    }

    // Update the updateStatsStats function to use pre-processed stats
    function updateStatsStatsFromStats(stats) {
        // Total workouts
        document.getElementById('totalWorkouts').textContent = stats.totalWorkouts;

        // Cycling workout count and percentage
        const cyclingCount = stats.cyclingWorkouts.length;
        document.getElementById('cyclingWorkouts').textContent = cyclingCount;
        
        const cyclingPercentage = stats.totalWorkouts > 0 ? 
            ((cyclingCount / stats.totalWorkouts) * 100).toFixed(1) : 0;
        document.getElementById('cyclingPercentage').textContent = `${cyclingPercentage}%`;

        // Total time spent and average workout length
        document.getElementById('totalTimeSpent').textContent = formatTime(stats.totalMinutes);
        const avgWorkoutLength = cyclingCount > 0 ? Math.round(stats.totalMinutes / cyclingCount) : 0;
        document.getElementById('avgWorkoutLength').textContent = formatTime(avgWorkoutLength);

        // Total distance
        document.getElementById('totalDistanceStats').textContent = `${stats.totalDistance.toFixed(1)} km`;

        // Total calories
        document.getElementById('totalCaloriesStats').textContent = stats.totalCalories.toLocaleString();

        // Favorite instructor
        let favoriteInstructor = '-';
        let favoriteInstructorTime = 0;
        let maxClasses = 0;
        Object.entries(stats.instructorStats).forEach(([instructor, info]) => {
            if (info.count > maxClasses) {
                maxClasses = info.count;
                favoriteInstructor = instructor;
                favoriteInstructorTime = info.minutes;
            }
        });
        document.getElementById('favoriteInstructor').textContent = favoriteInstructor;
        document.getElementById('favoriteInstructorTime').textContent = formatTime(favoriteInstructorTime);

        // Most frequent workout type
        let mostFrequentWorkout = '-';
        let maxCount = 0;
        Object.entries(stats.workoutTypes).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentWorkout = type;
            }
        });
        document.getElementById('mostFrequentWorkout').textContent = mostFrequentWorkout;
    }

    // Update the updateFunStats function to use pre-processed stats
    function updateFunStatsFromStats(stats) {
        // Constants for comparisons
        const BIG_MAC_CALORIES = 550; // calories in a Big Mac
        const TV_CALORIES_PER_HOUR = 100; // approximate calories burned watching TV
        const EARTH_CIRCUMFERENCE = 40075; // km around the equator
        const MOON_DISTANCE = 384400; // km to the moon
        const CAR_ENGINE_POWER = 100; // kW (average car engine power)
        const LIGHT_BULB_POWER = 0.06; // kW (60W light bulb)

        // Update calorie comparisons
        document.getElementById('totalCalories').textContent = `${stats.totalCalories.toLocaleString()} calories`;
        document.getElementById('bigMacs').textContent = `${(stats.totalCalories / BIG_MAC_CALORIES).toFixed(1)}`;
        document.getElementById('tvHours').textContent = `${(stats.totalCalories / TV_CALORIES_PER_HOUR).toFixed(1)}`;

        // Update distance comparisons
        document.getElementById('totalDistance').textContent = `${stats.totalDistance.toLocaleString()} km`;
        document.getElementById('aroundWorld').textContent = `${((stats.totalDistance / EARTH_CIRCUMFERENCE) * 100).toFixed(2)}%`;
        document.getElementById('toMoon').textContent = `${((stats.totalDistance / MOON_DISTANCE) * 100).toFixed(4)}%`;

        // Update output comparisons
        document.getElementById('totalOutput').textContent = `${stats.totalOutput.toLocaleString()} kJ`;
        document.getElementById('carEngine').textContent = `${(stats.totalOutput / (CAR_ENGINE_POWER * 3600)).toFixed(1)}x`;
        document.getElementById('lightBulb').textContent = `${(stats.totalOutput / (LIGHT_BULB_POWER * 86400)).toFixed(1)}x`;
    }

    // Update the updateStreaks function to use pre-processed stats
    function updateStreaks(stats) {
        // Calculate longest streak
        const longestStreak = calculateLongestStreak(stats.cyclingWorkouts);
        document.getElementById('longestStreak').textContent = `${longestStreak} days`;

        // Create workout heatmap
        createWorkoutHeatmap(stats.cyclingWorkouts);
    }

    function createOutputTrendChart(workouts, outputField = 'Total Output', lengthField = 'Length (minutes)') {
        const canvas = document.getElementById('outputTrendChart');
        if (!canvas) {
            console.error('Could not find outputTrendChart canvas element');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context for chart');
            return;
        }

        // Sort workouts by date
        const sortedWorkouts = [...workouts].sort((a, b) => {
            const dateA = new Date(a['Workout Timestamp'].replace(' (EST)', '').replace(' (UTC)', ''));
            const dateB = new Date(b['Workout Timestamp'].replace(' (EST)', '').replace(' (UTC)', ''));
            return dateA - dateB;
        });
        
        // Create class length filter buttons
        const classLengths = [5, 10, 15, 20, 30, 45, 60, 90, 120];
        const filterContainer = document.querySelector('.class-length-filters');
        
        if (!filterContainer) {
            // Create filter container if it doesn't exist
            const newFilterContainer = document.createElement('div');
            newFilterContainer.className = 'class-length-filters';
            newFilterContainer.style.marginBottom = '20px';
            newFilterContainer.style.textAlign = 'center';
            
            // Insert filter buttons before the chart
            canvas.parentNode.insertBefore(newFilterContainer, canvas);
            
            // Add buttons to container
            classLengths.forEach(length => {
                const button = document.createElement('button');
                button.textContent = `${length} min`;
                button.className = 'class-length-btn';
                button.onclick = () => updateChartForLength(sortedWorkouts, length, outputField, lengthField);
                newFilterContainer.appendChild(button);
            });
        } else {
            // Clear existing buttons
            filterContainer.innerHTML = '';
            
            // Add new buttons
            classLengths.forEach(length => {
                const button = document.createElement('button');
                button.textContent = `${length} min`;
                button.className = 'class-length-btn';
                button.onclick = () => updateChartForLength(sortedWorkouts, length, outputField, lengthField);
                filterContainer.appendChild(button);
            });
        }

        // Initial chart with all workouts
        updateChartForLength(sortedWorkouts, null, outputField, lengthField);
    }

    function updateChartForLength(workouts, length, outputField = 'Total Output', lengthField = 'Length (minutes)') {
        const canvas = document.getElementById('outputTrendChart');
        const ctx = canvas.getContext('2d');
        
        // Set active button
        document.querySelectorAll('.class-length-btn').forEach(btn => {
            if (btn.textContent === `${length} min`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Filter workouts by length if specified
        const filteredWorkouts = length 
            ? workouts.filter(w => parseFloat(w[lengthField]) === length)
            : workouts;

        // Prepare data for the chart
        const data = filteredWorkouts.map((workout, index) => ({
            x: index + 1, // Workout number
            y: parseFloat(workout[outputField]),
            date: new Date(workout['Workout Timestamp'].replace(' (EST)', '').replace(' (UTC)', '')).toLocaleDateString(),
            length: workout[lengthField]
        }));

        if (outputTrendChart) {
            outputTrendChart.destroy();
        }

        outputTrendChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: length ? `${length} min Output` : 'Workout Output',
                    data: data,
                    borderColor: '#3498db',
                    backgroundColor: '#3498db',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = context.raw;
                                return [
                                    `Output: ${data.y} kJ`,
                                    `Date: ${data.date}`,
                                    `Length: ${data.length} min`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Output (kJ)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Workout Number'
                        }
                    }
                }
            }
        });
    }

    // Add the missing updatePerformanceTrends function
    function updatePerformanceTrends(workouts) {
        // Print the workouts array length
        console.log('Total workouts before filtering:', workouts ? workouts.length : 0);
        
        // Ensure workouts is an array
        if (!workouts || !Array.isArray(workouts) || workouts.length === 0) {
            console.error('No valid workouts provided to updatePerformanceTrends');
            createFallbackOutputChart();
            return;
        }
        
        try {
            // Log a sample workout to see its structure
            console.log('Sample workout structure:', Object.keys(workouts[0]).join(', '));
            
            // Examine all available fields for debugging
            const allFields = new Set();
            workouts.forEach(workout => {
                Object.keys(workout).forEach(key => allFields.add(key));
            });
            console.log('All available fields in workouts:', Array.from(allFields).join(', '));
            
            // Look for potential alternative field names
            const possibleOutputFields = ['Total Output', 'Output', 'Total Work', 'kJ', 'Total kJ'];
            const possibleLengthFields = ['Length (minutes)', 'Length', 'Duration', 'Duration (minutes)', 'Minutes'];
            const possibleDisciplineFields = ['Fitness Discipline', 'Discipline', 'Type', 'Class Type', 'Workout Type'];
            
            // Determine which field names to use based on what's available
            let outputField = findMatchingField(workouts[0], possibleOutputFields);
            let lengthField = findMatchingField(workouts[0], possibleLengthFields);
            let disciplineField = findMatchingField(workouts[0], possibleDisciplineFields);
            
            console.log(`Using fields - Output: ${outputField || 'Not found'}, Length: ${lengthField || 'Not found'}, Discipline: ${disciplineField || 'Not found'}`);
            
            // If we still couldn't find the necessary fields, use fallbacks with default values
            if (!outputField) {
                console.warn('No output field found, using default values');
                outputField = 'Total Output';
            }
            
            if (!lengthField) {
                console.warn('No length field found, using default values');
                lengthField = 'Length (minutes)';
            }
            
            if (!disciplineField) {
                console.warn('No discipline field found, using default values');
                disciplineField = 'Fitness Discipline';
            }
            
            // Filter for cycling workouts with valid output data
            const cyclingWorkouts = workouts.filter(workout => {
                try {
                    // Check if workout is a cycling workout - be flexible with the value
                    const discipline = (workout[disciplineField] || '').toString().toLowerCase();
                    const isCycling = discipline.includes('cycl') || discipline.includes('bike') || discipline.includes('ride');
                    
                    if (!isCycling) {
                        return false;
                    }
                    
                    // Check if workout has valid output data
                    let output = workout[outputField];
                    // If output is not found but we have calories, estimate output (rough approximation)
                    if ((!output || isNaN(parseFloat(output))) && workout['Calories Burned']) {
                        // Roughly estimate: 1 calorie ~= 4.184 kJ of work
                        output = parseFloat(workout['Calories Burned']) / 4;
                    }
                    const hasOutput = output && !isNaN(parseFloat(output));
                    
                    // Check if workout has valid length data
                    let length = workout[lengthField];
                    // If length is not found but we have a duration timestamp, parse it (e.g. "01:30:00" -> 90 minutes)
                    if ((!length || isNaN(parseFloat(length))) && workout['Duration']) {
                        const durationMatch = workout['Duration'].match(/(\d+):(\d+):(\d+)/);
                        if (durationMatch) {
                            const [_, hours, minutes, seconds] = durationMatch;
                            length = parseInt(hours) * 60 + parseInt(minutes);
                        }
                    }
                    const hasLength = length && !isNaN(parseFloat(length));
                    
                    return hasOutput && hasLength;
                } catch (e) {
                    console.error('Error filtering workout:', e);
                    return false;
                }
            });

            console.log('Valid cycling workouts found:', cyclingWorkouts.length);
            
            if (cyclingWorkouts.length === 0) {
                console.error('No valid cycling workouts found with output data. Check console for detailed logs.');
                // Create a fallback chart with sample data if no workouts found
                createFallbackOutputChart();
                return;
            }

            createOutputTrendChart(cyclingWorkouts, outputField, lengthField);
        } catch (e) {
            console.error('Error in updatePerformanceTrends:', e);
            createFallbackOutputChart();
        }
    }

    // Helper function to find a matching field from possible options
    function findMatchingField(obj, possibleFields) {
        if (!obj) return null;
        
        for (const field of possibleFields) {
            if (field in obj && obj[field]) {
                console.log(`Found field: ${field} with value: ${obj[field]}`);
                return field;
            }
        }
        
        // If no exact match, try a partial match
        const objKeys = Object.keys(obj);
        for (const field of possibleFields) {
            const lowerField = field.toLowerCase();
            const matchingKey = objKeys.find(key => 
                key.toLowerCase().includes(lowerField)
            );
            
            if (matchingKey && obj[matchingKey]) {
                console.log(`Found partial match: ${matchingKey} for ${field}`);
                return matchingKey;
            }
        }
        
        return null;
    }

    // Create a fallback chart with sample data if no workouts found
    function createFallbackOutputChart() {
        const canvas = document.getElementById('outputTrendChart');
        if (!canvas) {
            console.error('Could not find outputTrendChart canvas element');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Add an information label above the chart
        const infoElement = document.createElement('div');
        infoElement.className = 'chart-info';
        infoElement.innerHTML = '<strong>Note:</strong> No valid workout data found with output values. Showing sample data.';
        infoElement.style.textAlign = 'center';
        infoElement.style.color = '#e74c3c';
        infoElement.style.marginBottom = '10px';
        canvas.parentNode.insertBefore(infoElement, canvas);
        
        // Create sample data
        const sampleData = [
            { x: 1, y: 150, date: 'Sample 1', length: '20' },
            { x: 2, y: 200, date: 'Sample 2', length: '20' },
            { x: 3, y: 185, date: 'Sample 3', length: '20' },
            { x: 4, y: 220, date: 'Sample 4', length: '20' },
            { x: 5, y: 250, date: 'Sample 5', length: '20' }
        ];
        
        // Create a fallback chart
        outputTrendChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Sample Output Data',
                    data: sampleData,
                    borderColor: '#3498db',
                    backgroundColor: '#3498db',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = context.raw;
                                return [
                                    `Output: ${data.y} kJ`,
                                    `Date: ${data.date}`,
                                    `Length: ${data.length} min`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Output (kJ)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Workout Number'
                        }
                    }
                }
            }
        });
    }

    function formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }
}); 