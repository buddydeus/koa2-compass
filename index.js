const os       = require("os"),
	  fs       = require("fs"),
	  path     = require("path"),
	  spawn    = require("child_process").spawn,
	  defaults = {
		  mode:        "compress",
		  comments:    false,
		  relative:    true,
		  css:         "stylesheets",
		  sass:        "stylesheets",
		  img:         "images",
		  project:     path.join(process.cwd(), "public"),
		  cache:       true,
		  logging:     false,
		  libs:        [],
		  config_file: false
	  };

module.exports = exports = function (opts) {
	opts = opts || {};
	for (let key in defaults) {
		if (opts[key] === undefined) {
			opts[key] = defaults[key];
		}
	}

	let cache     = {},
		sassCount = null;

	const getCSS          = function (file, done) {
			  return function (err, data) {
				  cache[file] = {
					  sass:  null,
					  mtime: null
				  };

				  if (done) done();
			  };
		  },
		  getSass         = function (fullPath, cssPath, done) {
			  return function (err, stats) {
				  cache[cssPath].sass = fullPath;
				  cache[cssPath].mtime = stats.mtime.getTime();

				  if (done) done();
			  };
		  },
		  last            = function (arr) {
			  return arr[arr.length - 1];
		  },
		  fillInSassFiles = function () {
			  fs.readdir(path.join(opts.project, opts.sass), function (err, files) {
				  let need = 0,
					  done = 0;

				  sassCount = 0;

				  const doneFunc = function () {
							done++;
							sassCount++;
						},
						waitFunc = function () {
							if (done < need) return setTimeout(waitFunc, 1);
						};

				  files.forEach(function (file, key) {
					  let parts = file.split(".");

					  if (["scss", "sass"].indexOf(last(parts)) === -1) return;

					  let name     = last(parts[0].split("/")),
						  fullPath = path.join(path.join(opts.project, opts.sass), file),
						  cssPath  = path.join(path.join(opts.project, opts.css), name) + ".css";

					  if (!cache[cssPath]) return;

					  need++;

					  fs.stat(fullPath, getSass(fullPath, cssPath, doneFunc));
				  });

				  waitFunc();
			  });
		  };

	return async function (ctx, next) {

		if (last(ctx.path.split(".")) !== "css") await next();
		else {
			let changes = false,
				go      = false,
				exit    = false;

			const getStat = function (key, item, done) {
				return function (err, stats) {

					if (err) {
						delete cache[key];
					}
					else if (item.mtime !== stats.mtime.getTime()) {
						changes = true;
					}

					if (done) done();
				};
			};

			if (!opts.cache) go = true;
			else {
				fs.readdir(path.join(opts.project, opts.sass), function (err, files) {
					if (err) {
						console.warn("node-compass: Project directory not found (SASS)");

						exit = true;

						return;
					}

					let count = 0;

					if (sassCount !== null) {
						for (let key in files) {
							let file = files[key];

							if (["sass", "scss"].indexOf(last(file.split("."))) !== -1) count++;
						}
					}

					if (count !== sassCount) {
						changes = true;
						go = true;
					}
					else {
						let need     = Object.keys(cache).length,
							done     = 0,
							doneFunc = function () {
								done++;
							},
							waitFunc = function () {
								if (done < need) return setTimeout(waitFunc, 1);

								if (!changes) exit = true;
								else go = true;
							};

						for (let key in cache) {
							let item = cache[key];

							try {
								fs.stat(item.sass, getStat(key, item, doneFunc));
							}
							catch (e) {
								delete cache[key];
								doneFunc();
							}
						}

						waitFunc();
					}
				});
			}

			(function waitingForGo () {
				if (!go) {
					if (!exit) {
						return setTimeout(waitingForGo, 1);
					}
					else {
						return next();
					}
				}

				cache = {};

				let options = [];

				options.push("compile");

				if (opts.config_file) {
					options.push("-c", opts.config_file);
				}
				else {
					if (!opts.comments) { options.push("--no-line-comments"); }
					if (opts.relative) { options.push("--relative-assets"); }

					options.push("--output-style", opts.mode);
					options.push("--css-dir", opts.css);
					options.push("--sass-dir", opts.sass);
					options.push("--images-dir", opts.img);
					if (Array.isArray(opts.libs) && opts.libs.length) {
						opts.libs.forEach(function (lib) {
							options.push("-r", lib);
						});
					}
				}

				let compassExecutable = "compass";
				if (os.platform() === "win32") {
					compassExecutable += ".bat";
				}

				let compass = spawn(
					compassExecutable,
					options,
					{
						cwd: opts.project
					}
				);

				compass.on("error", function (err) {
					if (err.code === "ENOENT") {
						console.error("node-compass: Compass executable not found. Please install compass.");
					}
					throw(err);
				});

				if (opts.logging) {
					compass.stdout.setEncoding("utf8");
					compass.stdout.on("data", function (data) {
						console.log(data);
					});

					compass.stderr.setEncoding("utf8");
					compass.stderr.on("data", function (data) {
						if (!data.match(/^\u001b\[\d+m$/)) {
							console.error("\u001b[31mstderr:\u001b[0m " + data);
						}
					});
				}

				if (opts.cache) {
					fs.readdir(path.join(opts.project, opts.css), function (err, files) {

						if (err) {
							console.warn("node-compass: Project directory not found (CSS)");

							return;
						}

						let done     = 0,
							need     = 0,
							doneFunc = function () {
								done++;
							};

						files.forEach(function (file, key) {
							if (last(file.split(".")) === "css") {
								need++;
								let full = path.join(path.join(opts.project, opts.sass), file);

								fs.readFile(full, getCSS(full, doneFunc));
							}
						});

						(function waiting () {
							if (done < need) return setTimeout(waiting, 1);

							fillInSassFiles();
						})();
					});
				}

				compass.on("exit", function (code) {
					return next();
				});
			})();
		}
	};
};