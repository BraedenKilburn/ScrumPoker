# Scrum Poker App

## Overview

The Scrum Poker App is a real-time web application designed to facilitate Scrum estimation sessions. It enables development teams to estimate tasks using the Scrum Poker technique in an interactive and collaborative online environment. The app supports room creation, voting, and real-time updates, making it a powerful tool for agile teams.

## Front End

The front end of the application is built using Vue.js, providing a user-friendly and responsive interface for users. The front end is responsible for rendering the UI, handling user interactions, and communicating with the back end to ensure real-time updates.

- **Technology:** Vue.js
- **Directory:** [front-end](front-end)

### Key Front End Features:

- **User-Friendly Interface:** Intuitive design for easy navigation and interaction.
- **Real-Time Updates:** Seamless integration with the back end to reflect real-time changes.
- **Responsive Design:** Optimized for various screen sizes and devices.

## Back End

The back end of the application is built using AWS Lambda, providing a serverless architecture that scales automatically to handle varying loads. It manages all server-side logic, including room management, vote processing, and communication with the front end via WebSockets through API Gateway.

- **Technology:** AWS Lambda, API Gateway, DynamoDB
- **Directory:** [back-end](back-end)

### Key Back End Features:

- **Serverless Architecture:** Built using AWS Lambda for automatic scaling and reduced operational overhead.
- **WebSocket Communication:** Ensures real-time interaction between the front end and back end.
- **Scalability:** Efficiently handles multiple rooms and participants simultaneously.

## Communication

The front end and back end communicate through WebSockets, enabling real-time updates and interactions. This ensures that all participants in a Scrum session see updates simultaneously, creating a smooth and interactive experience.

## Features

The Scrum Poker App includes the following features:

- **Room Creation:** Users can create rooms for holding estimation sessions, generating a unique room ID for participants to join.
- **Join Rooms:** Participants can join existing rooms using the provided room ID, facilitating collaborative estimation.
- **Vote Submission:** Users can submit their estimates for tasks. These votes are hidden until revealed by the session admin.
- **Vote Concealment:** Votes remain concealed until the admin decides to reveal them, ensuring unbiased estimation.
- **Real-Time Updates:** All activities, including joining rooms, submitting votes, and revealing estimates, are updated in real-time for all participants through WebSockets.
