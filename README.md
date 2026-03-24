在 Miao-Yunzai 或 TRSS-Yunzai 根目录下执行并重命名为任意文件或重启。
```sh
curl -o "./plugins/example/原神背包.js" "https://github.com/devil233-ui/GsMaterialPack/blob/master/plugins/example/%E5%8E%9F%E7%A5%9E%E8%83%8C%E5%8C%85.js"
```
如果装有 TRSS-plugin , 可发送如下指令给机器人并重命名为任意文件或重启。
```sh
rcp curl -o "./plugins/example/原神背包.js" "https://github.com/devil233-ui/GsMaterialPack/blob/master/plugins/example/%E5%8E%9F%E7%A5%9E%E8%83%8C%E5%8C%85.js"
```
</details>

然后下载resources文件夹放入genshin即可。

当前版本无法处理养成计算器材料溢出问题，仓鼠党如需屏蔽相关展示见js代码注释。

请勿催更，鼓励多用pr。理论上当前版本代码已实现了多数材料根据大地图和喵喵插件的新增资源的动态分类，只需要等他们更新即可。手动更新要做的仅仅是是打开mys养成计算器页面通过f12抓取字典而已，小白也能轻松上手。

整个仓库除了渲染模板都是本菜鸡vibe coding的产物，欢迎大佬优化（