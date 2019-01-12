## koa2-compass是什么?

koa2-compass是[koa@2.0.0](https://github.com/koajs/koa)的中间件，其前身是koa-compass模块，在[koa@2.0.0](https://github.com/koajs/koa)后没有对async进行兼容，所以此项目作为补丁插件存在。  
后期会扩展css压缩、图片压缩等功能。

## 安装与使用

- 安装
```bash
$ npm install -D koa2-compass
```

- 使用
```node
let app = new koa();

app.use(require("koa2-compass")({
	mode:    "compress",
	project: path.join(__dirname),
	sass:    "./scss",
	css:     "./static/css"
}));
app.use(require("koa-static")(path.join(__dirname, "./static")));
```
