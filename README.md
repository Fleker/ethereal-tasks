# Ethereal Tasks

This is a PWA for Google Tasks which takes advantage of auto-organization,
allowing you to add tasks easily from a mobile app while getting a
thorough management and viewer on larger screens.

It also supports a modular plugin framework in which you can connect to
multiple task systems and save their tasks in Google Tasks so that you
can have one app for everything.

This project is built on top of VTODO objects in the iCalendar spec, allowing
for standardization and a great deal of portability.

## Try it out
The PWA can be opened in https://felker.dev/etheral-tasks. This demo is hosted
on GitHub pages.

You can **Sign In With Google**. Due to API restrictions for non-certified
apps, you'll be presented with a warning.

Note: This application works entirely in the browser. No data is being stored
in the cloud.

### Filtering

When you start a task name with a particular string followed by a colon, ie.
"Tasks: Update README", that creates a _Folder_ called **Tasks**. Tapping on
that item in the sidebar will show only items that follow that pattern.

When you add a hashtag in the description of a task, ie. "add setup #github #tasks" that creates two _Tags_ called **github** and **tasks**. Tapping on either
will show only items that contain the same hashtag.

If you write in Markdown in task notes, that will be processed as Markdown when
rendered in the sidebar.

### Sync GitHub
You can sync GitHub tasks assigned to you to this app. They'll appear as
standard entries with `#github` in their description for quick filtering.

To do this, you'll need to generate a GitHub token that has access to your
repos and paste that token into your browser. This is saved in browser
local storage. Then it will be create, update, or complete tasks when you
run the sync.

## Setup and run locally

This is an Angular-based application that uses Google's frontend web APIs.

- You'll need to create a Google Cloud Project
  - Will require you enabling the Google Tasks API
  - Obtain a `CLIENT_ID` and update `app.component.ts`
- `npm install`
- `npm start`
