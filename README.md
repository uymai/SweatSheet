# SweatSheet

A client-side application to analyze Peloton workout data, providing insights into your fitness journey.

## Features

- **Workout Analysis**
  - Visualize workout type distribution
  - Track workout time patterns
  - Identify favorite instructors
  - View detailed workout metrics

- **Personal Records (PRs)**
  - Track PRs by ride type (Regular and LaneBreak)
  - Filter PRs by duration (5, 10, 15, 20, 30, 45, 60, 90 minutes, and 2 hours)
  - View PR progression over time
  - Compare current PRs to previous records
  - See detailed metrics for each PR including:
    - Class and workout dates
    - Instructor
    - Output
    - Average watts
    - Average resistance
    - Average cadence
    - Average speed
    - Distance
    - Calories burned
    - Average heart rate

- **Fun Stats**
  - Total calories burned compared to:
    - Number of Big Macs
    - Hours of watching TV
  - Total distance compared to:
    - Percentage around the world
    - Percentage to the moon
  - Total output compared to:
    - Running a car engine for X hours
    - Powering a light bulb for X days

## Usage

1. Export your Peloton workout data as a CSV file
2. Upload the CSV file using the file input
3. Click "Process CSV" to analyze your data
4. Explore your workout statistics and PRs

## Technical Details

- Built with vanilla JavaScript
- Uses Chart.js for visualizations
- Uses PapaParse for CSV parsing
- No server-side processing - all data stays on your device
- Responsive design for desktop and mobile viewing

## Privacy

All data processing happens locally in your browser. Your workout data is never sent to any server.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Chart.js](https://www.chartjs.org/) for data visualization
- [PapaParse](https://www.papaparse.com/) for CSV parsing 