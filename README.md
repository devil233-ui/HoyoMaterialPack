# 已知
支持全量查询和所有分类（仅原神）单独查询。当前版本无法处理养成原神计算器材料溢出问题（官方api限制），仓鼠党如需屏蔽相关展示于js内进行配置。

<details>

<summary>效果图点我展开</summary>

# 全量
![1f1406b24c53b9a7c96bb6b0d534cb66](https://github.com/user-attachments/assets/b2a34b6f-2345-4a2f-bd24-7051a04553af)
![9ce4c6853c6a1839261400675b504d27](https://github.com/user-attachments/assets/4ec27300-6e82-423c-b53b-8d7de80df601)

# 分类
![d4c0a28478574f27b976718dec6ee976_720](https://github.com/user-attachments/assets/f60e588a-d8e6-4f59-a121-faae5eda8749)

</details>

# 使用

在 Miao-Yunzai 或 TRSS-Yunzai 根目录下执行并进行任意重命名或重启。
```sh
curl -o "./plugins/example/米游材料背包.js" "https://raw.githubusercontent.com/devil233-ui/HoyoMaterialPack/refs/heads/master/plugins/example/%E7%B1%B3%E6%B8%B8%E6%9D%90%E6%96%99%E8%83%8C%E5%8C%85.js"
```
如果装有 TRSS-plugin , 可发送如下指令给机器人并进行任意重命名或重启。
```sh
rcp curl -o "./plugins/example/米游材料背包.js" "https://raw.githubusercontent.com/devil233-ui/HoyoMaterialPack/refs/heads/master/plugins/example/%e7%b1%b3%e6%b8%b8%e6%9d%90%e6%96%99%e8%83%8c%e5%8c%85.js"
```
</details>

然后下载resources文件夹放入genshin即可。

# Q & A

- 为什么感觉原神的养成材料算出来不太准？

  一般来说是准的，返回结果是优先合成的（只要用过官方计算器都知道），你可以换算一下进行核对；不一般的情况即为仓鼠党，这时请返回最开始那句。

请勿催更，鼓励多用pr。理论上当前版本代码已实现了全部材料根据mys计算器、大地图和喵喵插件的新增资源的动态分类，只需要等他们更新即可。

整个仓库除了渲染（感谢@[qsyhh](https://github.com/qsyhh)的原文件，让我得以在这之上调整和优化）相关都是本菜鸡vibe coding的产物，欢迎大佬优化（

交流群号：190370034
