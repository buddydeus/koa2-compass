const os       = require("os"),
	  fs       = require("fs"),
	  path     = require("path"),
	  spawn    = require("child_process").spawn,
	  jBD      = require("jbd"),
	  defaults = {
		  mode:     "compress",
		  comments: false,
		  relative: true,
		  css:      "stylesheets",
		  sass:     "stylesheets",
		  img:      "images",
		  project:  path.join(process.cwd(), "public"),
		  libs:     []
	  };

let opts;

async function middleware (ctx, next) {
	let dtd = jBD.Deferred(true);

	if (path.extname(ctx.path) !== ".css") {
		await next();
		dtd.resolve(ctx);
	}
	else {
		let exec    = "compass",
			options = [],
			compass;

		options.push("compile");

		if (!opts.comments) options.push("--no-line-comments");
		if (opts.relative) options.push("--relative-assets");

		options.push("--output-style", opts.mode);
		options.push("--css-dir", opts.css);
		options.push("--sass-dir", opts.sass);
		options.push("--images-dir", opts.img);
		if (Array.isArray(opts.libs) && opts.libs.length) {
			opts.libs.forEach(function (lib) {
				options.push("-r", lib);
			});
		}

		if (os.platform() === "win32") exec += ".bat";

		compass = spawn(
			exec, options,
			{cwd: opts.project}
		);

		compass.on("error", function (err) {
			if (err.code === "ENOENT") console.error("koa2-compass: Compass executable not found. Please install compass.");

			dtd.reject(err);
		});

		compass.on("exit", function (code) {
			(async function () {
				await next();
				dtd.resolve();
			})();
		});
	}

	return dtd.promise();
}

module.exports = exports = function (opt) {
	opts = opt || {};
	for (let key in defaults) {
		if (opts[key] === undefined) opts[key] = defaults[key];
	}

	return middleware;
};