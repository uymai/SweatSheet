export function getPRProgression(workouts) {
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

export function getWorkoutTypeDistribution(data) {
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

export function getTimeDistribution(data) {
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

export function getInstructorDistribution(data) {
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