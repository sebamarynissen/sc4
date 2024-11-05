// # index.js
'use strict';
const { ZoneType, FileType } = require('./enums.js');

exports.DBPF = require('./dbpf.js');
exports.Savegame = require('./savegame.js');
exports.ZoneType = ZoneType;
exports.FileType = FileType;

// Export all file classes. Third parties need to be able to use them all 
// obviously as they can be added to a dbpf.
Object.assign(exports, require('./file-classes.js'));

// Export more core data structures that third parties might use.
exports.Color = require('./color.js');
exports.Vertex = require('./vertex.js');
exports.Pointer = require('./pointer.js');
