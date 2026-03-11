#!/usr/bin/env node

/**
 * Multi-Agent Framework Dashboard Launcher
 * Starts the web server with dashboard
 */

const path = require('path');
const { startServer } = require('./api/server');

const args = process.argv.slice(2);
const portArg = args.find(function(arg) { return arg.startsWith('--port='); });
const port = portArg ? parseInt(portArg.split('=')[1]) : (process.env.PORT || 3000);
const rootDir = process.cwd();

startServer(port, rootDir);
