const express = require('express');
const path = require('path');
const indexRouter = require('./routes/index');

const app = express();

// Configure Pug template engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes - this should handle ALL routes including /timeline
app.use('/', indexRouter);

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).render('error', {
    siteName: "My Digital Diary",
    navItems: [],
    message: "Page not found",
    error: { status: 404 }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    siteName: "My Digital Diary",
    navItems: [],
    message: "Something went wrong!",
    error: { status: err.status || 500 }
  });
});

module.exports = app;