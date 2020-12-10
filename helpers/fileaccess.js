import fs from 'fs-extra'
import os from 'os';
import path from 'path';

const _fname = 'fileaccess.js';

var _priv = {
    misc: null
};

const fileaccess = {
    init: function (misc) {
        _priv.misc = misc;
    },
    exists: function (fullpath) {
        return fs.existsSync(fullpath);
    },
    readFile: function (jdir, jname, cbn) {
        var jfile = jdir + jname;
        fs.readFile(jfile, 'utf8', function (e, data) {
            cbn(e, data);
        });
    },
    readFileSync: function (jdir, jname) {
        const jfile = jdir + jname;

        let data;
        try {
            data = fs.readFileSync(jfile, 'utf8');
        } catch (err) {
            console.error("ERROR reading file " + jfile, err);
            return null;
        }

        return data;
    },
    getDesktopFolder: function () {
        const desktop = path.join(os.homedir(), "Desktop") + path.sep;
        return desktop;
    },
    readImageSync: function (jdir, jname, type) {
        var jfile = jdir + jname;
        let imgdata;
        if (!type) {
            let a = jname.split(".");
            type = a[a.length - 1];
        }
        let base;

        console.log("readImageSync going with " + jname + " TYPE: " + type);

        if (type == 'svg') {
            base = "data:image/svg+xml;charset=utf8,";
            try {
                imgdata = fs.readFileSync(jfile, 'utf8');
            } catch (err) {
                return null;
            }
        } else {
            try {
                imgdata = fs.readFileSync(jfile).toString('base64');
            } catch (err) {
                return null;
            }
            base = "data:image/" + type + ";base64,";
        }

        imgdata = base + imgdata;
        return imgdata;
    },
    writeFile: async function (jdir, jname, data, type) {
        var jfile = jdir + jname;
        try {
            if (type) {
                await fs.writeFile(jfile, data, type);
            } else {
                await fs.writeFile(jfile, data);
            }
        } catch (err) {
            _priv.misc.error(_fname, "writeFile", "e29", err);
        }
    },
    readJsonSync: function (jdir, jname, bQuiet) {
        const jfile = path.join(jdir, jname);
        let data = null;
        try {
            data = fs.readJsonSync(jfile);
        } catch (err) {
            if (!bQuiet && _priv.misc) {
                _priv.misc.log("error", "Error getting file " + jfile);
                console.error("Error reading file is", err);
            }
            return null;
        }

        return data;
    },
    readJsonCB: function (jdir, jname, cb, bQuiet) {
        var jfile = jdir + jname;
        fs.readJson(jfile, function (err, fileObj) {
            if (err) {
                if (!bQuiet) { _priv.misc.log("error", "fileaccess.js:readJsonCB", jfile, err); }
                cb(err);
            } else {
                cb(null, fileObj);
            }
        })
    },
    createWriteStream: function (jdir, jname) {
        const jfile = jdir + jname;
        try {
            return fs.createWriteStream(jfile);
        } catch (err) {
            _priv.misc.error(__filename, "createWriteStream", "e73", jfile, err);
            return null;
        }
    },
    readJson: async function (jdir, jname, bQuiet) {
        const jfile = jdir + jname;
        try {
            return await fs.readJson(jfile);
        } catch (err) {
            if (!bQuiet) { _priv.misc.log("error", "fileaccess.js:readJson", jfile, err); }
            return null;
        }
    },
    writeJson: async function (jdir, jname, jsonData, opts) {
        const _funcname = "writeJson";
        const jfile = jdir + jname;

        // NOTE. Using outputJson which will CREATE the directory if it does not exist.
        if (opts && opts.update) {
            // Read the file first.
            let olddata = await this.readJson(jdir, jname);
            if (olddata) {
                jsonData = Object.assign(olddata, jsonData);
            }
        }

        let bRet = true;
        try {
            await fs.outputJson(jfile, jsonData, { "spaces": 3 });
        } catch (err) {
            _priv.misc.error(_fname, _funcname, "e73", err);
            bRet = false;
        }
        return bRet;

    },
    writeJsonCB: function (jdir, jname, jsonData, cb) {
        var jfile = jdir + jname;
        //    console.log("WRITTING OUT JSON TO " + jfile);

        // var jsonout = JSON.stringify(jsonData, null, 2);

        fs.outputJson(jfile, jsonData, { "spaces": 3 }, function (err) {
            if (err) {
                console.error("Error writing JSON File " + jfile);
                console.error("Here is the jsonData:");
                console.error(jsonData);
                console.error("Here is the error message:");
                console.error(err);
                cb(err);
            } else {
                //         console.log("SUCCESS writing out json!!");
                cb(null, "success");
            }
        })
    },
    writeTextCB: function (fdir, fname, arrayData, bDeleteFileFirst, cbn) {
        let dfile = fdir + fname

        // Expects an array of strings
        let data;
        data = arrayData.join("\n");
        data += "\n";

        let __writeText = function () {
            fs.appendFile(dfile, data, function (err) {
                if (err) { cbn(err); } else { cbn(null, true); }
            });
        }

        if (bDeleteFileFirst) {
            this.deleteFile(fdir, fname, function () {
                __writeText();
            })
        } else {
            __writeText();
        }
    },
    writecsvCB: function (fdir, fname, arrayData, cbn) {
        var dfile = fdir + fname

        // Expects an array of arrays.
        var data;
        var ra = [];
        arrayData.forEach(function (row) {
            ra.push(row.join(","));
        });
        data = ra.join("\n");
        data += "\n";

        fs.appendFile(dfile, data, function (err) {
            if (err) { cbn(err); } else { cbn(null, true); }
        });
    },
    readcsv: async function (fdir, fname, bIgnoreErrors) {
        const dfile = fdir + fname

        let data = null;
        try {
            data = await fs.readFile(dfile, 'utf8');
        } catch (err) {
            if (!bIgnoreErrors) {
                _priv.misc.log("error", "readcsv for " + fdir, err);
                return null;
            }
        }
        const rdata = []
        const rows = data.toString().split(/(?:\r\n|\r|\n)/g)
        for (let n = 0; n < rows.length; n++) {
            const rowdata = rows[n].split(',')
            const rowd = []
            for (let m = 0; m < rowdata.length; m++) {
                rowd.push(rowdata[m].trim())
            }
            rdata.push(rowd)
        }
        return rdata;
    },
    readcsvCB: function (fdir, fname, cbn, bIgnoreErrors) {

        var dfile = fdir + fname

        fs.readFile(dfile, 'utf8', function (err, data) {
            if (err) {
                if (!bIgnoreErrors) {
                    console.error(err)
                }
                cbn(err);
            } else {
                var rdata = []
                var rows = data.toString().split(/(?:\r\n|\r|\n)/g)
                //        console.log(rows)
                for (let n = 0; n < rows.length; n++) {
                    var rowdata = rows[n].split(',')
                    var rowd = []
                    for (let m = 0; m < rowdata.length; m++) {
                        rowd.push(rowdata[m].trim())
                    }
                    rdata.push(rowd)
                }
                cbn(null, rdata);
            }
        });
    },
    deleteFile: function (fdir, fname, cbn) {
        var dfile = fdir + fname;
        console.log("Deleting the file " + dfile);
        fs.removeSync(dfile);
        if (cbn) {
            cbn(null, true);
        }
    },
    deleteFile2: function (fdir, fname) {
        var dfile = fdir + fname;
        console.log("Deleting the file " + dfile);
        fs.remove(dfile);
    },
    copyFile: async function (sdir, sfile, tdir, tfile, bDeleteSource) {
        /** Returns true if success */
        var srcfile = sdir + sfile;
        var trgfile = tdir + tfile;
        try {
            await fs.copy(srcfile, trgfile);
            if (bDeleteSource) {
                await fs.remove(srcfile);
            }
            return true;
        } catch (err) {
            _priv.misc.error(_fname, 'copyFile', 'e195', err);
            return false;
        }
    },
    readDirSync: function (fdir) {
        return fs.readdirSync(fdir);
    }
}

export default fileaccess