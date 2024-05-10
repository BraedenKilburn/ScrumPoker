# Scrum Poker App

## Overview

This Scrum Poker App is a real-time web application designed to facilitate Scrum estimation sessions. It allows development teams to estimate tasks using the Scrum Poker technique in an interactive and collaborative online setting.

### Front End

The front end of the application is built using Vue.js. It provides a user-friendly interface for users to interact with the application. The front end code is located in the [front-end](front-end) directory.

### Back End

The back end of the application is built using Express.js. It handles all the server-side logic and communicates with the front end through WebSockets. The back end code is located in the [back-end](back-end) directory.

### Communication

The front end and back end communicate with each other through WebSockets. This allows for real-time updates and interactions between multiple users.

## Features

The Scrum Poker App has the following features:

- **Room Creation:** Users can create rooms for holding estimation sessions.
- **Join Rooms:** Users can join existing rooms using room IDs.
- **Vote Submission:** Participants can submit their votes for estimation.
- **Vote Concealment:** Votes are concealed until revealed by a user.
- **Real-Time Updates:** All session activities are updated in real-time to all participants through web sockets.