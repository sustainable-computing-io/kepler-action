//const process = require('process');
//const cp = require('child_process');
//const path = require('path');
const cli = require('./command');

// shows how the runner will run a javascript action with env / stdout protocol

//test('test runs', () => {
  //process.env['INPUT_MILLISECONDS'] = 100;
  //const ip = path.join(__dirname, 'index.js');
  //   const result = cp.execSync(`node ${ip}`, {env: process.env}).toString();
  //const result = cp.execSync(`node ${ip}`).toString();
  //console.log(result);
//})

test('executeCommand with bin bash', () => {
  const echo = {}
  echo.command = '/bin/bash';
  echo.args = [];
  echo.args[0] = '-c';
  echo.args[1] = 'echo';
  echo.args[2] = 'man';
  cli.executeCommand(echo);
})

test('executeCommand with echo', () => {
  const echo = {}
  echo.command = 'echo';
  echo.args = [];
  echo.args[0] = 'man';
  cli.executeCommand(echo);
})

test('executeCommand with sudo', () => {
  const echo = {}
  echo.command = 'sudo';
  echo.args = [];
  echo.args[0] = 'echo';
  echo.args[1] = 'man';
  cli.executeCommand(echo);
})

test('ConvertCommand', () => {
  var str = 'sudo echo man';
  var command = cli.ConvertCommand(str);
  expect(str).toEqual('sudo echo man');
  expect(command.command).toEqual('sudo');
  expect(command.args[0]).toEqual('echo');
  expect(command.args[1]).toEqual('man');
})