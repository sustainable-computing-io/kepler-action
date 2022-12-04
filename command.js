const process = require('child_process');
const core = require('@actions/core');

exports.ConvertCommand = function(str) {
    core.debug(str);
    var command = {}
    command.args = [];
    command.command = "";
    const arr = str.split(' ');
    for (let i = 0; i < arr.length; i++) {
        if (i == 0) {
            command.command = arr[i];
        } else {
            command.args[i - 1] = arr[i];
        }
    }
    return command;
}

exports.executeCommand = function executeCommand(command) {
    core.debug(command.command);
    core.debug(command.args);
    return this.handleStatus(process.spawnSync(command.command, command.args));
}

exports.handleStatus = function handleStatus(rs) {
    if (rs.status !== 0) {
        if (rs.stderr) {
            core.setFailed(rs.stderr.toString('utf-8'));
        }
        if (rs.output) {
            core.setFailed(rs.output.toString('utf-8'));
        }
        if (!rs.stderr && !rs.output) {
            core.setFailed(JSON.stringify(rs));
        }
    } else {
        if (rs.stderr) {
            core.debug("std err:"+rs.stderr.toString('utf-8'));
        }
        if (rs.output) {
            core.debug("std output:"+rs.output.toString('utf-8'));
        }
    }
};