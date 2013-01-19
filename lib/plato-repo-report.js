var express = require('express');
var temp = require('temp');
var plato = require('plato');
var spawn = require('child_process').spawn;

var repoDir = temp.mkdirSync();
var platoDir = temp.mkdirSync();

var repoUrl;

var repoReady = false;
var platoReady = false;

function clone(cb) {
    console.log('Cloning the repository into temp dir ' + repoDir + '...');
    spawn('git', [ 'clone', repoUrl, '.' ], { cwd : repoDir, stdio : 'inherit' }).on('exit', function(code) {
        if (code) {
            console.log('Clone failed. Exiting...');
            process.exit(code);
        } 

        console.log('Repository cloned.');
        repoReady = true;
        cb && cb();
    });
}

function pull(cb) {
    console.log('Pulling new changes...');
    spawn('git', [ 'pull', repoUrl ], { cwd : repoDir, stdio : 'inherit' }).on('exit', function(code) {
        if (code) {
            console.log('Repository update failed.');
        } else {
            console.log('Repository updated.');
        }
        cb && cb(code);
    });
}

function inspect(cb) {
    console.log('Analyzing JS files...');
    // plato can't find common base if you give it a single directory.
    // ch dir to get around this and use '.' instead
    process.chdir(repoDir);
    plato.inspect([ '.' ], platoDir, {
        recurse : true,
        title : 'JS Report',
        jshint : { globals : {}, options : {} }
    }, function() {
        console.log('Report complete.');
        platoReady = true;
        cb && cb();
    });
}

function beginUpdatePolling() {
    setInterval(function() {
        pull(function(err) {
            if (!err) {
                inspect();
            }
        });
    }, 1000 * 60 * 60 * 24);// daily
}

module.exports = function(repositoryUrl, port) {
    repoUrl = repositoryUrl;
    port = port || 80;

    clone(function() {
        inspect(function() {
            console.log('Serving report at http://localhost' + (port === 80 ? '' : ':' + port));
            beginUpdatePolling();
        });
    });

    var app = express();
    app.get('/', function(req, res, next) {
        if (!platoReady) {
            res.send(502);
            return;
        }
        return next();
    });
    app.use(express['static'](platoDir));
    app.listen(port || 80);
};
