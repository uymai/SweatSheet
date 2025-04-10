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
        try {
            // Check if workouts is valid
            if (!workouts || !Array.isArray(workouts) || workouts.length === 0) {
                console.error('Invalid or empty workout data:', workouts);
                alert('No valid workout data found. Please check your CSV file format.');
                return;
            }
            
            console.log(`Processing ${workouts.length} workouts...`);
            
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
                cyclingWorkouts: [],
                
                // Store all valid workouts for streak calculations
                validWorkouts: []
            };
            
            // First pass - filter valid workouts with timestamps
            data.validWorkouts = workouts.filter(workout => 
                workout && workout['Workout Timestamp']
            );
            
            // Filter cycling workouts (subset of valid workouts)
            data.cyclingWorkouts = data.validWorkouts.filter(workout => 
                workout['Fitness Discipline'] === 'Cycling'
            );
            
            console.log(`Found ${data.validWorkouts.length} valid workouts, ${data.cyclingWorkouts.length} are cycling workouts`);
            
            // Sort cycling workouts by date
            try {
                data.sortedWorkouts = [...data.cyclingWorkouts].sort((a, b) => {
                    try {
                        // Clean timestamp strings and parse dates
                        const cleanTimestampA = (a['Workout Timestamp'] || '')
                            .replace(/ \(EST\)/g, '')
                            .replace(/ \(UTC\)/g, '')
                            .replace(/ \(EDT\)/g, '')
                            .replace(/ \([+-]\d{2}\)/g, '')
                            .trim();
                        
                        const cleanTimestampB = (b['Workout Timestamp'] || '')
                            .replace(/ \(EST\)/g, '')
                            .replace(/ \(UTC\)/g, '')
                            .replace(/ \(EDT\)/g, '')
                            .replace(/ \([+-]\d{2}\)/g, '')
                            .trim();
                        
                        const dateA = new Date(cleanTimestampA);
                        const dateB = new Date(cleanTimestampB);
                        
                        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                            return 0; // If dates are invalid, keep original order
                        }
                        
                        return dateA - dateB;
                    } catch (e) {
                        console.error('Error sorting workouts:', e);
                        return 0; // Keep original order on error
                    }
                });
                console.log(`Sorted ${data.sortedWorkouts.length} workouts by date`);
            } catch (e) {
                console.error('Error sorting workouts array:', e);
                data.sortedWorkouts = [...data.cyclingWorkouts]; // Just use unsorted array
            }
            
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
            
            // Process all valid workouts for streak calculation
            data.validWorkouts.forEach(workout => {
                try {
                    // Add workout day for streak calculation
                    const timestamp = workout['Workout Timestamp'] || '';
                    const cleanTimestamp = timestamp
                        .replace(/ \(EST\)/g, '')
                        .replace(/ \(UTC\)/g, '')
                        .replace(/ \(EDT\)/g, '')
                        .replace(/ \([+-]\d{2}\)/g, '')
                        .trim();
                    
                    const workoutDate = new Date(cleanTimestamp);
                    
                    // Skip invalid dates
                    if (!isNaN(workoutDate.getTime())) {
                        workoutDate.setHours(0, 0, 0, 0);
                        data.workoutDays.add(workoutDate.toISOString().split('T')[0]);
                    } else {
                        console.warn(`Could not parse workout date: ${timestamp}`);
                    }
                } catch (e) {
                    console.error('Error parsing date for streak calculation:', e);
                }
            });
            
            // Third pass - process cycling workouts for detailed stats
            data.cyclingWorkouts.forEach(workout => {
                // Basic stats
                data.totalWorkouts++;
                
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
        } catch (e) {
            console.error('Error processing workouts:', e);
            alert('Error processing workout data. Please check the console for details.');
        }
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
        
        // 3. Update instructor chart - filter out "Unknown" instructors
        const filteredInstructors = Object.entries(data.instructorStats)
            .filter(([instructor]) => instructor !== 'Unknown')
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10);
        
        const instructorData = {
            labels: filteredInstructors.map(item => item[0]),
            data: filteredInstructors.map(item => item[1].count)
        };
        instructorChart = createBarChart('instructorChart', 'Top Instructors', instructorData, 'instructor');
        
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
        updateStreaks(data);
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
        // Helper function to safely update element text content
        const safelyUpdateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };

        // Total workouts (all types)
        safelyUpdateElement('totalWorkouts', data.totalWorkouts);

        // Cycling workout count
        const cyclingCount = data.cyclingWorkouts.length;
        safelyUpdateElement('cyclingWorkouts', cyclingCount);
        
        // Cycling percentage
        const cyclingPercentage = data.totalWorkouts > 0 ? 
            ((cyclingCount / data.totalWorkouts) * 100).toFixed(1) : 0;
        safelyUpdateElement('cyclingPercentage', `${cyclingPercentage}%`);

        // Total time spent and average workout length (for cycling workouts)
        safelyUpdateElement('totalTimeSpent', formatTime(data.totalMinutes));
        const avgWorkoutLength = cyclingCount > 0 ? Math.round(data.totalMinutes / cyclingCount) : 0;
        safelyUpdateElement('avgWorkoutLength', formatTime(avgWorkoutLength));

        // Total distance
        safelyUpdateElement('totalDistanceStats', `${data.totalDistance.toFixed(1)} km`);

        // Total calories
        safelyUpdateElement('totalCaloriesStats', data.totalCalories.toLocaleString());

        // Favourite instructor - skip 'Unknown' instructors
        let favouriteInstructor = '-';
        let favouriteInstructorTime = 0;
        let maxClasses = 0;
        
        Object.entries(data.instructorStats).forEach(([instructor, stats]) => {
            if (instructor !== 'Unknown' && stats.count > maxClasses) {
                maxClasses = stats.count;
                favouriteInstructor = instructor;
                favouriteInstructorTime = stats.minutes;
            }
        });
        
        // Support both American and British/Canadian spellings
        safelyUpdateElement('favoriteInstructor', favouriteInstructor);
        safelyUpdateElement('favouriteInstructor', favouriteInstructor);
        safelyUpdateElement('favoriteInstructorTime', formatTime(favouriteInstructorTime));
        safelyUpdateElement('favouriteInstructorTime', formatTime(favouriteInstructorTime));

        // Most frequent workout type
        let mostFrequentWorkout = '-';
        let maxCount = 0;
        
        Object.entries(data.typeCount).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentWorkout = type;
            }
        });
        
        safelyUpdateElement('mostFrequentWorkout', mostFrequentWorkout);
    }

    function calculateLongestStreak(workouts) {
        console.log('Calculating longest streak...');
        
        // Filter for valid workouts only
        const validWorkouts = workouts.filter(workout => 
            workout && workout['Workout Timestamp']
        );
        
        console.log(`Found ${validWorkouts.length} valid workouts for streak calculation`);
        
        if (validWorkouts.length === 0) return 0;

        // Process workout dates and deduplicate by day
        const workoutDates = new Set();
        validWorkouts.forEach(workout => {
            try {
                // Get the WORKOUT timestamp string (not class timestamp)
                const timestamp = workout['Workout Timestamp'];
                if (!timestamp) {
                    console.warn('Workout missing timestamp:', workout);
                    return;
                }
                
                // Handle various formats by removing timezone indicators
                const cleanTimestamp = timestamp
                    .replace(/ \(EST\)/g, '')
                    .replace(/ \(UTC\)/g, '')
                    .replace(/ \(EDT\)/g, '')
                    .replace(/ \([+-]\d{2}\)/g, '')
                    .trim();
                
                // Parse the date
                const date = new Date(cleanTimestamp);
                
                // Skip invalid dates
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid date format: ${timestamp}`);
                    return;
                }
                
                // Get YYYY-MM-DD format
                const dateStr = date.toISOString().split('T')[0];
                workoutDates.add(dateStr);
            } catch (e) {
                console.error('Error parsing workout date:', e);
            }
        });
        
        console.log(`Found ${workoutDates.size} unique workout days`);
        
        if (workoutDates.size === 0) return 0;
        
        // Convert to array, sort chronologically
        const sortedDates = Array.from(workoutDates).sort();
        console.log('First workout date:', sortedDates[0]);
        console.log('Last workout date:', sortedDates[sortedDates.length - 1]);
        
        // Option 1: Standard streak calculation (no gaps allowed)
        let standardStreak = calculateStandardStreak(sortedDates);
        
        // Option 2: Lenient streak calculation (allowing one-day gaps)
        let lenientStreak = calculateLenientStreak(sortedDates);
        
        // Use the lenient streak calculation if it's significantly better
        const longestStreak = lenientStreak > standardStreak ? lenientStreak : standardStreak;
        
        console.log(`Standard streak (no gaps): ${standardStreak} days`);
        console.log(`Lenient streak (allowing one-day gaps): ${lenientStreak} days`);
        console.log(`Final longest streak: ${longestStreak} days`);
        
        return longestStreak;
    }
    
    // Helper function to calculate streak with no gaps allowed
    function calculateStandardStreak(sortedDates) {
        let currentStreak = 1;
        let maxStreak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
            const current = new Date(sortedDates[i]);
            const previous = new Date(sortedDates[i-1]);
            
            // Calculate days between dates
            const timeDiff = current.getTime() - previous.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff === 1) {
                // Consecutive day
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
                console.log(`Standard streak continues: ${sortedDates[i]}, current streak: ${currentStreak}`);
            } else {
                // Break in streak
                console.log(`Standard streak broken between ${sortedDates[i-1]} and ${sortedDates[i]}, gap of ${daysDiff-1} days`);
                currentStreak = 1;
            }
        }
        
        return maxStreak;
    }
    
    // Helper function to calculate streak allowing one-day gaps
    function calculateLenientStreak(sortedDates) {
        // Create a new array with dates filled in for single-day gaps
        const filledDates = [...sortedDates];
        
        // Find and fill single-day gaps
        for (let i = 1; i < sortedDates.length; i++) {
            const current = new Date(sortedDates[i]);
            const previous = new Date(sortedDates[i-1]);
            
            // Calculate days between dates
            const timeDiff = current.getTime() - previous.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff === 2) {
                // Add the missing day between these two dates
                const missingDay = new Date(previous);
                missingDay.setDate(missingDay.getDate() + 1);
                const missingDayStr = missingDay.toISOString().split('T')[0];
                filledDates.push(missingDayStr);
                console.log(`Added missing day ${missingDayStr} to lenient streak calculation`);
            }
        }
        
        // Sort again after adding missing days
        filledDates.sort();
        
        // Now calculate streak normally with filled dates
        let currentStreak = 1;
        let maxStreak = 1;
        
        for (let i = 1; i < filledDates.length; i++) {
            const current = new Date(filledDates[i]);
            const previous = new Date(filledDates[i-1]);
            
            // Calculate days between dates
            const timeDiff = current.getTime() - previous.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff === 1) {
                // Consecutive day
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
                console.log(`Lenient streak continues: ${filledDates[i]}, current streak: ${currentStreak}`);
            } else {
                // Break in streak (should be more than 1 day gap since we filled single-day gaps)
                console.log(`Lenient streak broken between ${filledDates[i-1]} and ${filledDates[i]}, gap of ${daysDiff-1} days`);
                currentStreak = 1;
            }
        }
        
        return maxStreak;
    }

    // Update the updateStreaks function to use pre-processed stats
    function updateStreaks(stats) {
        // Helper function to safely update element text content
        const safelyUpdateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };
        
        try {
            console.log('Updating streaks with data. Workout days:', stats.workoutDays.size);
            
            // If no workout days, display a message and return
            if (!stats.workoutDays || stats.workoutDays.size === 0) {
                safelyUpdateElement('longestStreak', 'No data');
                safelyUpdateElement('favoriteDay', 'No data');
                safelyUpdateElement('favoriteDayCount', '');
                
                const heatmapContainer = document.getElementById('workoutHeatmap');
                if (heatmapContainer) {
                    heatmapContainer.innerHTML = '<p class="text-center">No workout data available for heatmap display.</p>';
                }
                
                return;
            }
            
            // Calculate longest streak using all workout types
            const workoutDaysCount = Array.from(stats.workoutDays).length;
            console.log(`Found ${workoutDaysCount} workout days for streak calculation`);
            
            // Pass all workout types to the streak calculator
            const longestStreak = calculateLongestStreak(stats.validWorkouts || []);
            
            // Update UI with streak information
            if (longestStreak > 0) {
                safelyUpdateElement('longestStreak', `${longestStreak} days`);
                
                // Calculate standard streak (without missing day allowance)
                // Get all unique workout dates for streak calculation
                const workoutDates = Array.from(stats.workoutDays)
                    .map(dateStr => new Date(dateStr))
                    .sort((a, b) => a - b);
                    
                const standardStreak = calculateStandardStreak(workoutDates);
                
                // Show standard streak if different from the lenient streak
                if (standardStreak !== longestStreak) {
                    safelyUpdateElement('lenientStreak', `(${standardStreak} days strict)`);
                } else {
                    // If they're the same, hide the lenient streak display
                    const lenientElement = document.getElementById('lenientStreak');
                    if (lenientElement) {
                        lenientElement.textContent = '';
                    }
                }
            } else {
                safelyUpdateElement('longestStreak', 'No streaks found');
            }
            
            // Calculate favorite day of the week
            const favoriteDay = calculateFavoriteWorkoutDay(stats.validWorkouts || []);
            if (favoriteDay) {
                safelyUpdateElement('favoriteDay', favoriteDay.day);
                safelyUpdateElement('favoriteDayCount', `${favoriteDay.count} workouts`);
            } else {
                safelyUpdateElement('favoriteDay', 'Not enough data');
                safelyUpdateElement('favoriteDayCount', '');
            }

            // Create workout heatmap with all valid workouts
            createWorkoutHeatmap(stats.validWorkouts || []);
        } catch (error) {
            console.error('Error updating streaks:', error);
            safelyUpdateElement('longestStreak', 'Error calculating');
            safelyUpdateElement('favoriteDay', 'Error');
            safelyUpdateElement('favoriteDayCount', '');
            
            const heatmapContainer = document.getElementById('workoutHeatmap');
            if (heatmapContainer) {
                heatmapContainer.innerHTML = '<p class="text-center text-danger">Error creating workout heatmap. See console for details.</p>';
            }
        }
    }
    
    function calculateFavoriteWorkoutDay(workouts) {
        try {
            if (!workouts || workouts.length === 0) {
                return null;
            }
            
            // Count workouts by day of week
            const dayCount = {
                'Sunday': 0,
                'Monday': 0,
                'Tuesday': 0,
                'Wednesday': 0,
                'Thursday': 0,
                'Friday': 0,
                'Saturday': 0
            };
            
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            // Count occurrences of each day
            workouts.forEach(workout => {
                try {
                    if (!workout || !workout['Workout Timestamp']) return;
                    
                    // Handle various formats by removing timezone indicators
                    const cleanTimestamp = workout['Workout Timestamp']
                        .replace(/ \(EST\)/g, '')
                        .replace(/ \(UTC\)/g, '')
                        .replace(/ \(EDT\)/g, '')
                        .replace(/ \([+-]\d{2}\)/g, '')
                        .trim();
                    
                    // Parse the date
                    const date = new Date(cleanTimestamp);
                    
                    // Skip invalid dates
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid date format for favorite day calculation: ${workout['Workout Timestamp']}`);
                        return;
                    }
                    
                    // Get day of week and increment counter
                    const dayIndex = date.getDay();
                    const day = dayNames[dayIndex];
                    dayCount[day]++;
                } catch (e) {
                    console.error('Error processing workout date for favorite day:', e);
                }
            });
            
            // Create/update the day distribution chart
            createDayDistributionChart(dayCount);
            
            // Find the day with the most workouts
            let maxDay = null;
            let maxCount = 0;
            
            for (const [day, count] of Object.entries(dayCount)) {
                if (count > maxCount) {
                    maxDay = day;
                    maxCount = count;
                }
            }
            
            // Only return a result if we have at least 3 workouts on that day
            if (maxCount >= 3) {
                return {
                    day: maxDay,
                    count: maxCount
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error calculating favorite workout day:', error);
            return null;
        }
    }
    
    function createDayDistributionChart(dayCount) {
        try {
            const canvas = document.getElementById('dayDistributionChart');
            if (!canvas) {
                console.warn('Day distribution chart canvas not found');
                return;
            }
            
            // Define ordered days of the week (starting with Sunday)
            const orderedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            // Prepare data in the correct order
            const labels = orderedDays;
            const data = orderedDays.map(day => dayCount[day] || 0);
            
            // Find the max count to highlight the favorite day
            const maxCount = Math.max(...data);
            const maxIndex = data.indexOf(maxCount);
            
            // Create color array with the max value highlighted
            const backgroundColors = data.map((value, index) => 
                index === maxIndex ? '#2ecc71' : '#95a5a6'
            );
            
            // Check if we already have a chart and destroy it
            if (window.dayDistributionChart instanceof Chart) {
                window.dayDistributionChart.destroy();
            }
            
            // Create the chart
            window.dayDistributionChart = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Workouts',
                        data: data,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(color => color === '#2ecc71' ? '#27ae60' : '#7f8c8d'),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw;
                                    return value === 1 ? '1 workout' : `${value} workouts`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            },
                            title: {
                                display: true,
                                text: 'Workouts'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Day of Week'
                            }
                        }
                    }
                }
            });
            
            console.log('Day distribution chart created successfully');
        } catch (error) {
            console.error('Error creating day distribution chart:', error);
        }
    }

    function createWorkoutHeatmap(workouts) {
        try {
            console.log('Creating workout heatmap...');
            
            const heatmapContainer = document.getElementById('workoutHeatmap');
            if (!heatmapContainer) {
                console.warn('Element with ID "workoutHeatmap" not found');
                return;
            }
            
            heatmapContainer.innerHTML = '';

            // Filter for valid workouts (any type, not just cycling)
            const validWorkouts = workouts.filter(workout => 
                workout && workout['Workout Timestamp']
            );
            
            console.log(`Found ${validWorkouts.length} valid workouts for heatmap`);
            
            if (validWorkouts.length === 0) {
                heatmapContainer.innerHTML = '<p class="text-center">No workouts found to display in the heatmap.</p>';
                return;
            }

            // Get date range (last 12 months)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 11);
            startDate.setDate(1);
            
            console.log(`Creating heatmap from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

            // Create a map of workout dates
            const workoutDates = new Map();
            validWorkouts.forEach(workout => {
                try {
                    // Get the Workout Timestamp
                    const timestamp = workout['Workout Timestamp'];
                    if (!timestamp) return;
                    
                    // Handle various formats by removing timezone indicators
                    const cleanTimestamp = timestamp
                        .replace(/ \(EST\)/g, '')
                        .replace(/ \(UTC\)/g, '')
                        .replace(/ \(EDT\)/g, '')
                        .replace(/ \([+-]\d{2}\)/g, '')
                        .trim();
                    
                    // Parse the date
                    const date = new Date(cleanTimestamp);
                    
                    // Skip invalid dates
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid date format for heatmap: ${timestamp}`);
                        return;
                    }
                    
                    // Set to start of day
                    date.setHours(0, 0, 0, 0);
                    
                    // Convert to YYYY-MM-DD format
                    const dateStr = date.toISOString().split('T')[0];
                    
                    // Increment count for this date
                    workoutDates.set(dateStr, (workoutDates.get(dateStr) || 0) + 1);
                } catch (e) {
                    console.error('Error parsing date for heatmap:', e);
                }
            });
            
            console.log(`Found ${workoutDates.size} unique workout days for heatmap`);
            
            // Sample of workouts found (up to 5)
            const sample = Array.from(workoutDates.entries()).slice(0, 5);
            sample.forEach(([date, count]) => {
                console.log(`Sample workout day: ${date}, count: ${count}`);
            });

            // Generate heatmap
            let currentDate = new Date(startDate);
            let monthsCreated = 0;
            
            while (currentDate <= endDate && monthsCreated < 12) {
                // Create a month container
                const monthDiv = document.createElement('div');
                monthDiv.className = 'heatmap-month';
                
                // Add month label
                const monthLabel = document.createElement('div');
                monthLabel.className = 'heatmap-month-label';
                monthLabel.textContent = currentDate.toLocaleString('default', { month: 'short' }) + ' ' + currentDate.getFullYear();
                monthDiv.appendChild(monthLabel);
                
                // Add day of week header
                const weekdayHeader = document.createElement('div');
                weekdayHeader.className = 'day-of-week-header';
                
                // Add abbreviated day names
                const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                for (let i = 0; i < 7; i++) {
                    const daySpan = document.createElement('span');
                    daySpan.textContent = dayNames[i];
                    weekdayHeader.appendChild(daySpan);
                }
                monthDiv.appendChild(weekdayHeader);
                
                // Create grid for days
                const daysGrid = document.createElement('div');
                daysGrid.className = 'month-days-grid';
                monthDiv.appendChild(daysGrid);

                // Calculate days for this month
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                
                // Add empty cells for days before the 1st of the month
                for (let i = 0; i < firstDayOfMonth; i++) {
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'heatmap-day empty-day';
                    daysGrid.appendChild(emptyDay);
                }

                // Add days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                    // Create date object for this day
                    const date = new Date(year, month, day);
                    const dateStr = date.toISOString().split('T')[0];
                    
                    // Get workout count for this day
                    const workoutCount = workoutDates.get(dateStr) || 0;

                    // Create day element
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'heatmap-day';
                    dayDiv.setAttribute('data-date', dateStr);
                    dayDiv.setAttribute('title', dateStr + (workoutCount > 0 ? ` (${workoutCount} workouts)` : ''));
                    
                    // Add day number as text
                    dayDiv.textContent = day;
                    
                    // Add intensity level based on workout count
                    if (workoutCount > 0) {
                        // Set color intensity level (1-4)
                        const level = Math.min(Math.ceil(workoutCount / 2), 4);
                        dayDiv.setAttribute('data-level', level);
                        dayDiv.style.cursor = 'pointer';
                    }

                    daysGrid.appendChild(dayDiv);
                }
                
                // Add empty cells at the end if needed to complete the grid
                const totalCells = firstDayOfMonth + daysInMonth;
                const cellsToAdd = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                
                for (let i = 0; i < cellsToAdd; i++) {
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'heatmap-day empty-day';
                    daysGrid.appendChild(emptyDay);
                }

                // Add the month to the heatmap
                heatmapContainer.appendChild(monthDiv);
                
                // Move to next month
                currentDate.setMonth(currentDate.getMonth() + 1);
                monthsCreated++;
            }
            
            console.log(`Created heatmap with ${monthsCreated} months`);
        } catch (error) {
            console.error('Error creating workout heatmap:', error);
            
            // Show error message in heatmap container
            if (document.getElementById('workoutHeatmap')) {
                document.getElementById('workoutHeatmap').innerHTML = 
                    '<p class="text-center text-danger">Error creating workout heatmap. See console for details.</p>';
            }
        }
    }

    // PR navigation state
    let currentPRIndex = 0;
    let currentRideType = 'regular';
    let currentDuration = 5;
    let regularPRs = {};
    let laneBreakPRs = {};

    function displayPRs(data) {
        if (!data || !Array.isArray(data)) {
            console.error('Invalid data passed to displayPRs');
            return;
        }

        // Only select cycling workouts for PR analysis
        const cyclingWorkouts = data.filter(row => {
            // Basic validation
            if (!row || typeof row !== 'object') {
                return false;
            }
            
            // Must have a Workout Timestamp
            if (!row['Workout Timestamp']) {
                return false;
            }
            
            // Must be cycling
            if (!(row['Fitness Discipline'] || '').toLowerCase().includes('cycling')) {
                return false;
            }

            // Must have a valid length (greater than 0)
            const length = parseInt(row['Length (minutes)']);
            if (isNaN(length) || length <= 0) {
                return false;
            }

            // Must not be a Just Ride or any "Just" workout type (for PR calculations only)
            const type = (row['Type'] || '').toLowerCase();
            const title = (row['Title'] || '').toLowerCase();
            
            // Check if it contains "just" in type or title
            const isJustWorkout = type.includes('just') || title.includes('just');
            
            return !isJustWorkout;
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
        
        try {
            // Handle different formats of Peloton dates
            // Format 1: "2023-01-01 10:00 (EST)"
            // Format 2: "2023-01-01 10:00 (UTC)"
            // Format 3: "2023-01-01 10:00 (+00)"
            // Format 4: "2023-01-01 10:00" (no timezone)
            
            // Remove any timezone indicators and parse as local time
            const cleanDateStr = dateStr
                .replace(/\(EST\)|\(UTC\)|\(EDT\)|\([+-]\d{2}\)/g, '')
                .trim();
                
            const date = new Date(cleanDateStr);
            
            // Check if the date is valid
            if (isNaN(date.getTime())) {
                console.warn(`Invalid date format: ${dateStr}`);
                return null;
            }
            
            return date;
        } catch (e) {
            console.error('Error parsing date:', dateStr, e);
            return null;
        }
    }

    function findPRsByLength(workouts) {
        try {
            const prs = {};
            
            if (!workouts || !Array.isArray(workouts)) {
                console.error('Invalid workout data received:', workouts);
                return {};
            }
            
            workouts.forEach(workout => {
                try {
                    // Safe parsing of values with defaults
                    const length = parseInt(workout['Length (minutes)'] || '0');
                    const output = parseFloat(workout['Total Output'] || '0');
                    
                    // Skip invalid entries
                    if (isNaN(length) || length <= 0 || isNaN(output) || output <= 0) {
                        return;
                    }
                    
                    if (!prs[length]) {
                        prs[length] = [];
                    }
                    
                    prs[length].push({
                        length: length,
                        output: output,
                        date: workout['Class Timestamp'] || '',
                        workoutDate: workout['Workout Timestamp'] || '',
                        instructor: workout['Instructor Name'] || 'Unknown',
                        type: workout['Type'] || '',
                        avgWatts: workout['Avg. Watts'] || '',
                        avgResistance: workout['Avg. Resistance'] || '',
                        avgCadence: workout['Avg. Cadence (RPM)'] || '',
                        avgSpeed: workout['Avg. Speed (kph)'] || '',
                        distance: workout['Distance (km)'] || '',
                        calories: workout['Calories Burned'] || '',
                        avgHeartrate: workout['Avg. Heartrate'] || ''
                    });
                } catch (workoutError) {
                    console.error('Error processing individual workout:', workoutError);
                }
            });

            // For each duration, find the actual PR progression
            Object.keys(prs).forEach(duration => {
                try {
                    // Sort by date
                    prs[duration].sort((a, b) => {
                        const dateA = parsePelotonDate(a.date);
                        const dateB = parsePelotonDate(b.date);
                        
                        // Handle case where dates can't be parsed
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;  // a is later (null dates at the end)
                        if (!dateB) return -1; // b is later
                        
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
                } catch (durationError) {
                    console.error(`Error processing PR progression for duration ${duration}:`, durationError);
                    prs[duration] = []; // Reset to empty array on error
                }
            });

            return prs;
        } catch (error) {
            console.error('Error in findPRsByLength:', error);
            return {};
        }
    }

    function updatePRCard() {
        try {
            // Helper function to safely update element text content
            const safelyUpdateElement = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                } else {
                    console.warn(`Element with ID '${id}' not found`);
                }
            };
            
            const currentPRs = (currentRideType === 'regular' ? regularPRs : laneBreakPRs)[currentDuration] || [];
            
            if (!currentPRs || currentPRs.length === 0) {
                const noResultsText = `No ${currentRideType === 'regular' ? 'Regular' : 'LaneBreak'} ${currentDuration} min PRs found`;
                safelyUpdateElement('prTitle', noResultsText);
                safelyUpdateElement('prClassDate', '');
                safelyUpdateElement('prWorkoutDate', '');
                safelyUpdateElement('prProgression', '');
                safelyUpdateElement('prInstructor', '');
                safelyUpdateElement('prOutput', '');
                safelyUpdateElement('prWatts', '');
                safelyUpdateElement('prResistance', '');
                safelyUpdateElement('prCadence', '');
                safelyUpdateElement('prSpeed', '');
                safelyUpdateElement('prDistance', '');
                safelyUpdateElement('prCalories', '');
                safelyUpdateElement('prHeartrate', '');
                
                // Disable navigation buttons if no PRs
                const prevButton = document.getElementById('prevPR');
                const nextButton = document.getElementById('nextPR');
                if (prevButton) prevButton.disabled = true;
                if (nextButton) nextButton.disabled = true;
                
                return;
            }

            // Ensure currentPRIndex is within bounds
            if (currentPRIndex >= currentPRs.length) {
                currentPRIndex = 0;
            }

            const pr = currentPRs[currentPRIndex];
            console.log('PR data:', pr); // Debug log
            
            if (!pr) {
                console.error('Invalid PR data at index', currentPRIndex);
                return;
            }
            
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
            safelyUpdateElement('prTitle', `${pr.length} Minute ${pr.type || ''}`);
            safelyUpdateElement('prClassDate', formattedClassDate);
            safelyUpdateElement('prWorkoutDate', formattedWorkoutDate);
            safelyUpdateElement('prInstructor', pr.instructor || '-');
            safelyUpdateElement('prOutput', `${pr.output || '-'} kJ`);
            safelyUpdateElement('prWatts', `${pr.avgWatts || '-'} W`);
            safelyUpdateElement('prResistance', `${pr.avgResistance || '-'}`);
            safelyUpdateElement('prCadence', `${pr.avgCadence || '-'} RPM`);
            safelyUpdateElement('prSpeed', `${pr.avgSpeed || '-'} kph`);
            safelyUpdateElement('prDistance', `${pr.distance || '-'} km`);
            safelyUpdateElement('prCalories', `${pr.calories || '-'}`);
            safelyUpdateElement('prHeartrate', `${pr.avgHeartrate || '-'} bpm`);

            // Update navigation buttons
            const prevButton = document.getElementById('prevPR');
            const nextButton = document.getElementById('nextPR');
            
            if (prevButton) prevButton.disabled = currentPRIndex === currentPRs.length - 1;
            if (nextButton) nextButton.disabled = currentPRIndex === 0;

            // Add PR progression information
            const nextPR = currentPRIndex > 0 ? currentPRs[currentPRIndex - 1] : null;
            const outputDiff = nextPR ? nextPR.output - pr.output : 0;
            
            // Update the navigation text to show PR progression
            if (nextPR) {
                safelyUpdateElement('prProgression', `Beaten by ${outputDiff.toFixed(1)} kJ`);
            } else {
                safelyUpdateElement('prProgression', 'Latest PR!');
            }
        } catch (e) {
            console.error('Error updating PR card:', e);
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

    function createBarChart(canvasId, title, data, chartType = 'default') {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // For instructor chart, calculate the appropriate y-axis min value
        let yAxisOptions = {
            beginAtZero: true,
            ticks: {
                stepSize: 1
            }
        };
        
        // Define color palette
        const colorPalette = [
            '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
            '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
        ];
        
        // If this is the instructor chart, adjust the scale based on data range
        if (chartType === 'instructor' && data.data.length > 0) {
            const minValue = Math.min(...data.data);
            const maxValue = Math.max(...data.data);
            const range = maxValue - minValue;
            
            // Only adjust scale if the range is less than 50% of the max value
            // This prevents extreme zooming on charts with small absolute differences
            if (range < maxValue * 0.5) {
                // Set min to approximately 70% of the minimum value to add more padding
                const adjustedMin = Math.max(0, Math.floor(minValue * 0.7));
                console.log(`Adjusting instructor chart scale: min=${adjustedMin}, data range: ${minValue}-${maxValue}`);
                
                yAxisOptions = {
                    beginAtZero: false,
                    min: adjustedMin,
                    ticks: {
                        stepSize: Math.max(1, Math.ceil(range / 8))  // Dynamic step size with at least 8 tick marks
                    }
                };
            }
        }
        
        // Prepare dataset options
        let datasetOptions = {
            label: 'Number of Workouts',
            data: data.data
        };
        
        // Set different background colors based on chart type
        if (chartType === 'instructor') {
            // Use a color for each bar for instructor chart
            datasetOptions.backgroundColor = data.data.map((_, index) => 
                colorPalette[index % colorPalette.length]
            );
        } else {
            // Use a single color for other bar charts
            datasetOptions.backgroundColor = '#3498db';
        }
        
        const chartOptions = {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function(context) {
                            const value = context.raw;
                            if (chartType === 'instructor') {
                                return `${value} workouts with ${context.label}`;
                            } else {
                                return `${value} workouts`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: yAxisOptions
            }
        };
        
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [datasetOptions]
            },
            options: chartOptions
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
        try {
            const file = e.target.files[0];
            if (file) {
                // Reset the application state
                resetApplication();
                
                // Show loading indicator
                const container = document.querySelector('.container');
                if (!container) {
                    console.warn('Container element not found');
                    return;
                }
                
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'loading-indicator';
                loadingIndicator.innerHTML = 'Processing data...';
                container.appendChild(loadingIndicator);
                
                // Use setTimeout to allow the loading indicator to render
                setTimeout(() => {
                    try {
                        Papa.parse(file, {
                            header: true,
                            complete: function(results) {
                                try {
                                    allWorkouts = results.data || [];
                                    
                                    if (!allWorkouts.length) {
                                        throw new Error('No workout data found in CSV');
                                    }
                                    
                                    console.log(`Successfully parsed ${allWorkouts.length} workouts`);
                                    
                                    // Process workouts once to extract all necessary data
                                    const stats = processWorkoutsOnce(allWorkouts);
                                    
                                    // Update all UI components with the extracted data
                                    createVisualizations(allWorkouts, stats);
                                    displayPRs(allWorkouts);
                                    updatePerformanceTrends(stats.cyclingWorkouts);
                                    updateStreaks(stats);
                                    
                                    // Remove loading indicator
                                    const indicator = document.querySelector('.loading-indicator');
                                    if (indicator) {
                                        indicator.remove();
                                    }
                                    
                                    // Disable the process button since data is already processed
                                    const processBtn = document.getElementById('processBtn');
                                    if (processBtn) {
                                        processBtn.disabled = true;
                                        processBtn.textContent = 'Data Processed';
                                    }
                                } catch (processError) {
                                    console.error('Error processing CSV data:', processError);
                                    alert('Error processing the workout data. See console for details.');
                                    
                                    // Remove loading indicator
                                    document.querySelector('.loading-indicator')?.remove();
                                }
                            },
                            error: function(error) {
                                console.error('Error parsing CSV:', error);
                                document.querySelector('.loading-indicator')?.remove();
                                alert('Error parsing CSV file. Please check the file format.');
                            }
                        });
                    } catch (parseError) {
                        console.error('Error starting CSV parse:', parseError);
                        document.querySelector('.loading-indicator')?.remove();
                        alert('Error parsing CSV file. Please check the file format.');
                    }
                }, 50);
            }
        } catch (fileError) {
            console.error('Error handling file selection:', fileError);
            alert('Error selecting file. Please try again.');
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
        console.log('Begin processing workouts...');
        
        // Filter out any empty rows or rows with missing timestamps
        const validWorkouts = workouts.filter(workout => workout && workout['Workout Timestamp']);
        
        console.log(`Found ${validWorkouts.length} workouts with timestamps out of ${workouts.length} total`);
        
        // Log a few sample workouts to see their format
        if (validWorkouts.length > 0) {
            console.log('Sample workout timestamp formats:');
            for (let i = 0; i < Math.min(3, validWorkouts.length); i++) {
                console.log(`Sample ${i+1}: ${validWorkouts[i]['Workout Timestamp']}`);
            }
        }
        
        const stats = {
            // Store all valid workouts for streak calculations
            validWorkouts: validWorkouts,
            
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
                    .replace(/ \(EST\)/g, '')
                    .replace(/ \(UTC\)/g, '')
                    .replace(/ \(EDT\)/g, '')
                    .replace(/ \([+-]\d{2}\)/g, '')
                    .trim();
                
                const date = new Date(cleanTimestamp);
                
                // Skip invalid dates
                if (!isNaN(date.getTime())) {
                    date.setHours(0, 0, 0, 0);
                    const dateStr = date.toISOString().split('T')[0];
                    stats.workoutDays.add(dateStr);
                } else {
                    console.warn(`Could not parse workout date: ${timestamp}`);
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
        try {
            // Helper function to safely create or update a chart
            const safelyCreateChart = (canvasId, chartType, title, chartData) => {
                const canvas = document.getElementById(canvasId);
                if (!canvas) {
                    console.warn(`Canvas with ID '${canvasId}' not found`);
                    return null;
                }
                
                try {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        console.warn(`Unable to get 2D context for canvas '${canvasId}'`);
                        return null;
                    }
                    
                    // If there's an existing chart, destroy it
                    if (chartType === 'workoutType' && workoutTypeChart) {
                        workoutTypeChart.destroy();
                    } else if (chartType === 'timeDistribution' && timeDistributionChart) {
                        timeDistributionChart.destroy();
                    } else if (chartType === 'instructor' && instructorChart) {
                        instructorChart.destroy();
                    }
                    
                    if (chartType === 'workoutType') {
                        return createPieChart(canvasId, title, chartData);
                    } else if (chartType === 'instructor') {
                        return createBarChart(canvasId, title, chartData, 'instructor');
                    } else {
                        return createBarChart(canvasId, title, chartData);
                    }
                } catch (err) {
                    console.error(`Error creating ${chartType} chart:`, err);
                    return null;
                }
            };
        
            // Filter out any empty rows
            const validData = data.filter(row => row['Workout Timestamp']);

            // Create workout type distribution chart
            const workoutTypeData = {
                labels: Object.keys(stats.workoutTypes),
                data: Object.values(stats.workoutTypes)
            };
            workoutTypeChart = safelyCreateChart('workoutTypeChart', 'workoutType', 'Workout Type Distribution', workoutTypeData);

            // Create time distribution chart
            const timeData = {
                labels: Object.keys(stats.workoutLengths).map(t => `${t} min`),
                data: Object.values(stats.workoutLengths)
            };
            timeDistributionChart = safelyCreateChart('timeDistributionChart', 'timeDistribution', 'Workout Time Distribution', timeData);

            // Create instructor distribution chart - filter out "Unknown" instructors
            const filteredInstructors = Object.entries(stats.instructorStats)
                .filter(([instructor]) => instructor !== 'Unknown')
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);
            
            const instructorData = {
                labels: filteredInstructors.map(item => item[0]),
                data: filteredInstructors.map(item => item[1].count)
            };
            instructorChart = safelyCreateChart('instructorChart', 'instructor', 'Top Instructors', instructorData);

            // Update stats stats
            updateStatsStatsFromStats(stats);
            
            // Update fun stats
            updateFunStatsFromStats(stats);
        } catch (error) {
            console.error('Error creating visualizations:', error);
        }
    }

    // Update the updateStatsStats function to use pre-processed stats
    function updateStatsStatsFromStats(stats) {
        // Helper function to safely update element text content
        const safelyUpdateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };

        // Total workouts
        safelyUpdateElement('totalWorkouts', stats.totalWorkouts);

        // Cycling workout count
        const cyclingCount = stats.cyclingWorkouts.length;
        safelyUpdateElement('cyclingWorkouts', cyclingCount);
        
        const cyclingPercentage = stats.totalWorkouts > 0 ? 
            ((cyclingCount / stats.totalWorkouts) * 100).toFixed(1) : 0;
        safelyUpdateElement('cyclingPercentage', `${cyclingPercentage}%`);

        // Total time spent and average workout length
        safelyUpdateElement('totalTimeSpent', formatTime(stats.totalMinutes));
        const avgWorkoutLength = cyclingCount > 0 ? Math.round(stats.totalMinutes / cyclingCount) : 0;
        safelyUpdateElement('avgWorkoutLength', formatTime(avgWorkoutLength));

        // Total distance
        safelyUpdateElement('totalDistanceStats', `${stats.totalDistance.toFixed(1)} km`);

        // Total calories
        safelyUpdateElement('totalCaloriesStats', stats.totalCalories.toLocaleString());

        // Favourite instructor - skip 'Unknown' instructors
        let favouriteInstructor = '-';
        let favouriteInstructorTime = 0;
        let maxClasses = 0;
        Object.entries(stats.instructorStats).forEach(([instructor, info]) => {
            if (instructor !== 'Unknown' && info.count > maxClasses) {
                maxClasses = info.count;
                favouriteInstructor = instructor;
                favouriteInstructorTime = info.minutes;
            }
        });
        
        // Support both American and British/Canadian spellings
        safelyUpdateElement('favoriteInstructor', favouriteInstructor);
        safelyUpdateElement('favouriteInstructor', favouriteInstructor);
        safelyUpdateElement('favoriteInstructorTime', formatTime(favouriteInstructorTime));
        safelyUpdateElement('favouriteInstructorTime', formatTime(favouriteInstructorTime));

        // Most frequent workout type
        let mostFrequentWorkout = '-';
        let maxCount = 0;
        Object.entries(stats.workoutTypes).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentWorkout = type;
            }
        });
        safelyUpdateElement('mostFrequentWorkout', mostFrequentWorkout);
    }

    // Update the updateFunStats function to use pre-processed stats
    function updateFunStatsFromStats(stats) {
        // Helper function to safely update element text content
        const safelyUpdateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };
        
        // Constants for comparisons
        const BIG_MAC_CALORIES = 550; // calories in a Big Mac
        const TV_CALORIES_PER_HOUR = 100; // approximate calories burned watching TV
        const EARTH_CIRCUMFERENCE = 40075; // km around the equator
        const MOON_DISTANCE = 384400; // km to the moon
        const CAR_ENGINE_POWER = 100; // kW (average car engine power)
        const LIGHT_BULB_POWER = 0.06; // kW (60W light bulb)

        // Update calorie comparisons
        safelyUpdateElement('totalCalories', `${stats.totalCalories.toLocaleString()} calories`);
        safelyUpdateElement('bigMacs', `${(stats.totalCalories / BIG_MAC_CALORIES).toFixed(1)}`);
        safelyUpdateElement('tvHours', `${(stats.totalCalories / TV_CALORIES_PER_HOUR).toFixed(1)}`);

        // Update distance comparisons
        safelyUpdateElement('totalDistance', `${stats.totalDistance.toLocaleString()} km`);
        safelyUpdateElement('aroundWorld', `${((stats.totalDistance / EARTH_CIRCUMFERENCE) * 100).toFixed(2)}%`);
        safelyUpdateElement('toMoon', `${((stats.totalDistance / MOON_DISTANCE) * 100).toFixed(4)}%`);

        // Update output comparisons
        safelyUpdateElement('totalOutput', `${stats.totalOutput.toLocaleString()} kJ`);
        safelyUpdateElement('carEngine', `${(stats.totalOutput / (CAR_ENGINE_POWER * 3600)).toFixed(1)}x`);
        safelyUpdateElement('lightBulb', `${(stats.totalOutput / (LIGHT_BULB_POWER * 86400)).toFixed(1)}x`);
    }

    // Update the updateStreaks function to use pre-processed stats
    function updateStreaks(stats) {
        // Helper function to safely update element text content
        const safelyUpdateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };
        
        try {
            console.log('Updating streaks with data. Workout days:', stats.workoutDays.size);
            
            // If no workout days, display a message and return
            if (!stats.workoutDays || stats.workoutDays.size === 0) {
                safelyUpdateElement('longestStreak', 'No data');
                safelyUpdateElement('favoriteDay', 'No data');
                safelyUpdateElement('favoriteDayCount', '');
                
                const heatmapContainer = document.getElementById('workoutHeatmap');
                if (heatmapContainer) {
                    heatmapContainer.innerHTML = '<p class="text-center">No workout data available for heatmap display.</p>';
                }
                
                return;
            }
            
            // Calculate longest streak using all workout types
            const workoutDaysCount = Array.from(stats.workoutDays).length;
            console.log(`Found ${workoutDaysCount} workout days for streak calculation`);
            
            // Pass all workout types to the streak calculator
            const longestStreak = calculateLongestStreak(stats.validWorkouts || []);
            
            // Update UI with streak information
            if (longestStreak > 0) {
                safelyUpdateElement('longestStreak', `${longestStreak} days`);
                
                // Calculate standard streak (without missing day allowance)
                // Get all unique workout dates for streak calculation
                const workoutDates = Array.from(stats.workoutDays)
                    .map(dateStr => new Date(dateStr))
                    .sort((a, b) => a - b);
                    
                const standardStreak = calculateStandardStreak(workoutDates);
                
                // Show standard streak if different from the lenient streak
                if (standardStreak !== longestStreak) {
                    safelyUpdateElement('lenientStreak', `(${standardStreak} days strict)`);
                } else {
                    // If they're the same, hide the lenient streak display
                    const lenientElement = document.getElementById('lenientStreak');
                    if (lenientElement) {
                        lenientElement.textContent = '';
                    }
                }
            } else {
                safelyUpdateElement('longestStreak', 'No streaks found');
            }
            
            // Calculate favorite day of the week
            const favoriteDay = calculateFavoriteWorkoutDay(stats.validWorkouts || []);
            if (favoriteDay) {
                safelyUpdateElement('favoriteDay', favoriteDay.day);
                safelyUpdateElement('favoriteDayCount', `${favoriteDay.count} workouts`);
            } else {
                safelyUpdateElement('favoriteDay', 'Not enough data');
                safelyUpdateElement('favoriteDayCount', '');
            }

            // Create workout heatmap with all valid workouts
            createWorkoutHeatmap(stats.validWorkouts || []);
        } catch (error) {
            console.error('Error updating streaks:', error);
            safelyUpdateElement('longestStreak', 'Error calculating');
            safelyUpdateElement('favoriteDay', 'Error');
            safelyUpdateElement('favoriteDayCount', '');
            
            const heatmapContainer = document.getElementById('workoutHeatmap');
            if (heatmapContainer) {
                heatmapContainer.innerHTML = '<p class="text-center text-danger">Error creating workout heatmap. See console for details.</p>';
            }
        }
    }
    
        } catch (error) {
            console.error('Error creating day distribution chart:', error);
        }
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

        // Calculate moving average if we have enough data points
        let averageData = [];
        if (data.length >= 3) {
            const windowSize = Math.min(3, Math.floor(data.length / 2)); // Use a window of 3 or half the data points
            for (let i = windowSize - 1; i < data.length; i++) {
                let sum = 0;
                for (let j = 0; j < windowSize; j++) {
                    sum += data[i - j].y;
                }
                averageData.push({
                    x: data[i].x,
                    y: sum / windowSize
                });
            }
        }

        if (outputTrendChart) {
            outputTrendChart.destroy();
        }

        outputTrendChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: length ? `${length} min Output` : 'Output',
                        data: data,
                        borderColor: '#3498db',
                        backgroundColor: '#3498db',
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    ...(averageData.length > 0 ? [{
                        label: 'Moving Average (3 workouts)',
                        data: averageData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        borderWidth: 2,
                        type: 'line',
                        tension: 0.4
                    }] : [])
                ]
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
                                if (context.datasetIndex === 0) {
                                    const workout = filteredWorkouts[context.dataIndex];
                                    return [
                                        `Output: ${workout[outputField]} kJ`,
                                        `Date: ${new Date(workout['Workout Timestamp']).toLocaleDateString()}`,
                                        `Length: ${workout[lengthField]} min`
                                    ];
                                } else {
                                    return `Moving Average: ${context.raw.y.toFixed(1)} kJ`;
                                }
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