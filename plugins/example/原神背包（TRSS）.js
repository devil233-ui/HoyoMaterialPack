//开发维护&&反馈群190370034
//本仓库暂不公开，请在getRemoteJson方法下填入秘钥
import plugin from '../../lib/plugins/plugin.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import fetch from 'node-fetch'
import fs from 'node:fs/promises'
import path from 'node:path'
import MysInfo from '../genshin/model/mys/mysInfo.js'
import { Material } from "../miao-plugin/models/index.js"

const WeeklyData = getWeeklyData()

export class MyMaterialPack extends plugin {
  constructor() {
    super({
      name: '原神材料背包',
      dsc: '单文件版全量/分类/周本材料背包',
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: '^#?(星铁)?(我的)?周本(材料|素材)?背包(升序|降序)?$',
          fnc: 'materialsWeekly'
        },
        {
          reg: '^#?(星铁)?(我的)?(.*?)(材料|素材)?背包$',
          fnc: 'materials'
        }
      ]
    })
    this.mapDict = null
    this._path = process.cwd().replace(/\\/g, "/")
  }

  async materials() {
    if (this.e.isSr) return this.reply('该功能暂不支持星铁')
    let msg = this.e.msg.replace(/^#/, '')
    let targetCategory = null
    let isAll = msg === "背包" || msg === "背包材料" || msg === "材料背包" || msg.includes("全部") || msg.includes("原神背包")

    const categoryKeywords = {
      'weekly': ['周本'],
      'talent': ['天赋', '技能'],
      'weapon': ['武器'],
      'other': ['采集', '特产', '基础', '怪物']
    }

    if (!isAll) {
      for (const [catKey, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => msg.includes(kw))) {
          targetCategory = catKey
          break
        }
      }
      if (!targetCategory) isAll = true
    }

    let data = await this.getMaterialsData(targetCategory, isAll)
    if (!data) return

    let img = await puppeteer.screenshot('materialPack', {
      ...data,
      tplFile: './plugins/genshin/resources/html/materialPack/materialPack.html',
      pluResPath: `${this._path}/plugins/genshin/resources/`
    })
    
    if (img) {
      try {
        await this.reply(img)
      } catch (err) {
        await this.reply('图片体积过大，正在转为文件发送...')
        let base64Str = typeof img === 'string' ? img : (img.file || '')
        let buffer = Buffer.from(base64Str.replace(/^base64:\/\//, ''), 'base64')
        let savePath = path.resolve('./data/my_material_temp.jpg')
        await fs.writeFile(savePath, buffer)
        await this.reply([{ type: 'image', file: `file://${savePath}` }])
      }
    }
  }

  async materialsWeekly() {
    if (this.e.isSr) return this.reply('该功能暂不支持星铁')
    let data = await this.getMaterialsData('weekly', false)
    if (!data?.materials?.weekly) return

    const { materials: { weekly } } = data
    if (!Array.isArray(weekly) || !weekly.length) return this.reply('没有查询到周本材料数据')

    const dataMap = new Map()
    const countMap = new Map()
    for (const item of weekly) {
      const weeklyName = findWeeklyNameByItemName(item.name)
      if (weeklyName) {
        if (!dataMap.has(weeklyName)) {
          dataMap.set(weeklyName, [])
          countMap.set(weeklyName, 0)
        }
        dataMap.get(weeklyName).push(item)
        countMap.set(weeklyName, countMap.get(weeklyName) + item.num)
      }
    }

    if (!dataMap.size) return this.reply('没找到匹配周本，请检查字典是否更新')

    data.weeklyList = [...dataMap.keys()].map(name => [name, countMap.get(name), dataMap.get(name)])
    const order = this.e.msg.match(/升序|降序/)
    if (order) {
      const isAsc = order[0] === '升序'
      data.weeklyList.sort((a, b) => isAsc ? a[1] - b[1] : b[1] - a[1])
    }

    let img = await puppeteer.screenshot('materialWeeklyPack', {
      ...data,
      tplFile: `./plugins/genshin/resources/html/materialPack/materialWeeklyPack.html`,
      pluResPath: `${this._path}/plugins/genshin/resources/`
    })
    if (img) await this.reply(img)
  }

  async getMaterialsData(targetCategory, isAll) {
    let uid = await MysInfo.getUid(this.e)
    if (!uid) return false
    let { ck } = await MysInfo.checkUidBing(uid, this.e) || {}
    if (!ck) return this.e.reply(MysInfo.tips), false

    await this.e.reply('正在获取最新材料数据，请稍候...')

    let rawMaterials = await this.fetchRawMaterials(uid, ck)
    let { role } = (await MysInfo.get(this.e, 'index')).data || {}
    if (!rawMaterials || !role) return this.e.reply('获取失败，请确保 my_computeBody.json 正常'), false

    let materials = {}
    if (isAll) {
      materials = rawMaterials
    } else {
      materials[targetCategory] = rawMaterials[targetCategory] || []
      materials.length = materials[targetCategory].length
    }

    let genshinPath = path.resolve('./plugins/genshin/resources')
    let miaoPath = path.resolve('./plugins/miao-plugin/resources')
    
    return {
      _res_path: `${genshinPath}/`,
      _miao_path: `${miaoPath}/`,
      defaultLayout: path.join(miaoPath, 'common/layout/default.html'),
      sys: { copyright: '数据源：GitHub远程字典 + 官方大地图同步' },
      uid, role, materials
    }
  }

  async getRemoteJson(fileName) {
    // 👇 填入你的 GitHub Personal Access Token (classic 或 fine-grained 均可)
    const GH_PAT = ''; 
    
    try {
      let url = `https://raw.githubusercontent.com/devil233-ui/GsMaterialPack/master/data/${fileName}`
      
      let res = await fetch(url, {
        method: 'get',
        headers: {
          'Authorization': `token ${GH_PAT}`,
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'Yunzai-Bot-MaterialPack'
        }
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      
      return res
    } catch (err) {
      console.error(`[材料背包] 私库访问失败 ${fileName}:`, err.message)
      // 如果报错 HTTP 404，大概率是 Token 权限没给够（需要 repo 权限）或路径错了
      return null
    }
  }
  
//   async getRemoteJson(fileName) {
//     try {
//       let url = `https://raw.githubusercontent.com/devil233-ui/GsMaterialPack/master/data/${fileName}`
//       let res = await fetch(url).then(res => res.json())
//       return res
//     } catch (err) {
//       console.error(`[材料背包] 获取远程字典 ${fileName} 失败:`, err.message)
//       return null
//     }
//   }

  async fetchRawMaterials(uid, ck) {
    let ret = { length: 0 }
    let mergedData = new Map()

    // 拉取远程 material.json 构建精准分类映射
    let materialJson = await this.getRemoteJson('material.json')
    let customTypeMap = {}
    if (materialJson && materialJson.data) {
      // 将中文大类映射为 HTML 模板需要的英文 key (适配 materialPack.html 里的 typeMap)
      const mapCatToEng = {
        '区域特产': 'specialty',
        '敌人': 'monster',
        '背包/素材': 'other'
        // 周本和天赋暂时走正则兜底，后期可能考虑加进来
      }
      for (let cat in materialJson.data) {
        let eType = mapCatToEng[cat] || 'other'
        for (let itemId in materialJson.data[cat]) {
          customTypeMap[materialJson.data[cat][itemId].name] = eType
        }
      }
    }

    // A. 大地图
    try {
      let mapUrl = "https://api-takumi.mihoyo.com/common/map_user/ys_obc/v1/user/sync_game_material_info?map_id=2&app_sn=ys_obc&lang=zh-cn"
      let mapRes = await fetch(mapUrl, { method: "get", headers: { "Cookie": ck, "Referer": "https://act.mihoyo.com", "User-Agent": "okhttp/4.8.0" } }).then(res => res.json())
      if (mapRes?.retcode === 0) {
        let dict = await this.getMapDict()
        for (let [id, num] of Object.entries(mapRes.data.material_info)) {
          if (num <= 0 || !dict[id]) continue
          let itemName = dict[id].name
          let meta = Material.get(itemName)
          
          // 优先级：远程 JSON 分类 > 喵喵元数据 > 正则兜底 > other
          let type = customTypeMap[itemName] || meta?.type || 'other'
          if (!meta && (/样本|弃局|源焰|灵犀|哀叙|残毁|假面|约束|瓶剂/.test(itemName))) type = 'weekly'
          if (!meta && (/哲学|指引|教导/.test(itemName))) type = 'talent'
          
          mergedData.set(itemName, { id: meta?.id || Number(id), name: itemName, num, icon: dict[id].icon, type })
        }
      }
    } catch (e) {}

    // B. 计算器
    try {
      let baseBody = await this.getRemoteJson('my_computeBody.json')
      if (baseBody) {
        let fpRes = await MysInfo.get(this.e, 'getFp')
        let region = (String(uid)[0] === '1' || String(uid)[0] === '2') ? 'cn_gf01' : 'cn_qd01'
        let silentE = { ...this.e, reply: () => {} }
        let computes = await MysInfo.get(silentE, 'compute', {
          body: { ...baseBody, region, uid: String(uid) },
          headers: { 'x-rpc-device_fp': fpRes?.data?.device_fp || '' }
        })
        if (computes?.retcode === 0 && computes.data?.overall_consume) {
          computes.data.overall_consume.forEach(val => {
            let owned = val.lack_num < 0 ? Math.abs(val.lack_num) + val.num : val.num - val.lack_num
            if (owned > 0 && !mergedData.has(val.name)) {
              let meta = Material.get(val.name)
              let type = customTypeMap[val.name] || meta?.type || 'other'
              if (!meta && (/样本|弃局|源焰|灵犀|哀叙|残毁|假面|约束|瓶剂/.test(val.name))) type = 'weekly'
              if (!meta && (/哲学|指引|教导/.test(val.name))) type = 'talent'
              
              mergedData.set(val.name, { id: meta?.id || val.id, name: val.name, num: owned, icon: val.icon, type })
            }
          })
        }
      }
    } catch (e) {}

    for (let item of mergedData.values()) {
      ret[item.type] ||= []; ret[item.type].push(item); ret.length++
    }
    for (let i in ret) { if (i !== 'length' && Array.isArray(ret[i])) ret[i].sort((a, b) => b.id - a.id) }
    return ret
  }

  async getMapDict() {
    if (this.mapDict) return this.mapDict
    try {
      let url = "https://api-takumi.mihoyo.com/common/map_user/ys_obc/v1/map/label/tree?map_id=2&app_sn=ys_obc&lang=zh-cn"
      let res = await fetch(url).then(res => res.json())
      if (res?.retcode === 0) {
        let dict = {}
        for (let cat of res.data.tree) cat.children?.forEach(item => dict[item.id] = { name: item.name, icon: item.icon })
        this.mapDict = dict
        return dict
      }
    } catch (e) {}
    return {}
  }
}

function findWeeklyNameByItemName(itemName) {
  for (const [name, items] of WeeklyData) if (items.includes(itemName)) return name
  return null
}

function getWeeklyData() {
  return [
    ["风魔龙", ["东风之翎", "东风之爪", "东风的吐息"]],
    ["北风的王狼", ["北风之尾", "北风之环", "北风的魂匣"]],
    ["「公子」", ["吞天之鲸·只角", "魔王之刃·残片", "武炼之魂·孤影"]],
    ["若陀龙王", ["龙王之冕", "血玉之枝", "鎏金之鳞"]],
    ["「女士」", ["熔毁之刻", "狱火之蝶", "灰烬之心"]],
    ["「祸津御建鸣神命」", ["凶将之手眼", "祸神之禊泪", "万劫之真意"]],
    ["「正机之神」", ["傀儡的悬丝", "无心的渊镜", "空行的虚铃"]],
    ["阿佩普的绿洲守望者", ["生长天地之蕨草", "原初绿洲之初绽", "亘古树海之一瞬"]],
    ["吞星之鲸", ["无光丝线", "无光涡眼", "无光质块"]],
    ["「仆人」", ["残火灯烛", "丝织之羽", "否定裁断"]],
    ["蚀灭的源焰之主", ["蚀灭的鳞羽", "蚀灭的阳焰", "蚀灭的灵犀"]],
    ["门扉前的弈局", ["升扬样本·骑士", "升扬样本·战车", "升扬样本·王族"]],
    ["赝月的研究所掉落", ["贤医的假面", "狂人的约束", "异端的瓶剂"]]
  ]
}
