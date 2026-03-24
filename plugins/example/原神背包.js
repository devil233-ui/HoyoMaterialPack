//开发维护&&反馈群190370034，作者devil
import plugin from '../../lib/plugins/plugin.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import fetch from 'node-fetch'
import path from 'node:path'
import MysInfo from '../genshin/model/mys/mysInfo.js'
import { Material } from "../miao-plugin/models/index.js"

// 是否在全部查询时展示受计算器上限影响的不准确材料（武器突破、天赋与武器培养培养），后者即精英+普通敌人掉落
// true: 默认展示所有 | false: 在全量一图流中隐藏，单独查询不受影响
const SHOW_COMPUTE_IN_ALL = true;

export class MyMaterialPack extends plugin {
  constructor() {
    super({
      name: '原神材料背包',
      dsc: '动态分类+静态字典全量背包',
      event: 'message',
      priority: -114514,
      rule: [
        { reg: '^#?(星铁)?(我的)?周本(材料|素材)背包(升序|降序)?$', fnc: 'materialsWeekly' },
        { reg: '^#?(星铁)?(我的)?(培养|矿物|木材|其他|道具|天赋|武器|特产|boss|角色突破|全部)?(材料|素材)背包$', fnc: 'materials' }
      ]
    })
    this.mapDict = null
    this._path = process.cwd().replace(/\\/g, "/")
    // this.GH_PAT = ''
  }

  async materials() {
    if (this.e.isSr) return this.reply('该功能暂不支持星铁')
    let msg = this.e.msg.replace(/^#/, '')

    const cmdMap = {
      '矿物': 'ore', '木材': 'wood', '其他': 'other',
      '道具': 'adventureItem', '天赋': 'talent', '武器': 'weapon',
      '特产': 'specialty', 'boss': 'boss', '角色突破': 'gem'
    }

    let target = null
    let isAll = msg.includes('全部') || msg === '背包' || msg === '材料背包'
    let isDevelop = msg.includes('培养')

    for (let [k, v] of Object.entries(cmdMap)) {
      if (msg.includes(k)) { target = v; break }
    }

    let data = await this.getMaterialsData(target, isAll, isDevelop)
    if (!data) return

    let img = await puppeteer.screenshot('materialPack', {
      ...data,
      tplFile: './plugins/genshin/resources/html/materialPack/materialPack.html',
      pluResPath: `${this._path}/plugins/genshin/resources/`
    })
    if (img) await this.reply(img)
  }

  async getMaterialsData(target, isAll, isDevelop) {
    let uid = await MysInfo.getUid(this.e)
    if (!uid) return false
    let { ck } = await MysInfo.checkUidBing(uid, this.e) || {}
    if (!ck) return this.e.reply(MysInfo.tips), false

    await this.e.reply('正在拉取GitHub字典并动态识别新材料...')

    let raw = await this.fetchRawMaterials(uid, ck)
    let { role } = (await MysInfo.get(this.e, 'index')).data || {}
    if (!raw || !role) return this.e.reply('获取失败，请检查GitHub秘钥或配置'), false

    let materials = {}
    if (isAll) {
      materials = raw
      if (!SHOW_COMPUTE_IN_ALL) {
        delete materials['weapon']
        // delete materials['boss']//你要是大世界boss都能爆那就把这行注释去掉
        delete materials['monster']
        delete materials['normal']
      }
    } else if (isDevelop) {
      materials['monster'] = raw['monster'] || []
      materials['normal'] = raw['normal'] || []
    } else if (target) {
      materials[target] = raw[target] || []
    }

    return {
      _res_path: `${path.resolve('./plugins/genshin/resources')}/`,
      _miao_path: `${path.resolve('./plugins/miao-plugin/resources')}/`,
      defaultLayout: path.join(path.resolve('./plugins/miao-plugin/resources'), 'common/layout/default.html'),
      sys: { copyright: '数据源：GitHub字典 + 动态分类' },
      uid, role, materials
    }
  }

  async fetchRawMaterials(uid, ck) {
    let mergedData = new Map()
    let [materialDict, weeklyBossDict] = await Promise.all([
      this.getRemoteJson('materialDict.json'),
      this.getRemoteJson('weeklyBoss.json')
    ])

    let manualDict = materialDict?.data || materialDict || {}
    let weeklyList = Array.isArray(weeklyBossDict) ? weeklyBossDict : (weeklyBossDict?.data || [])
    let dict = await this.getMapDict()

    const getDynamicType = (item) => {
      let name = item.name
      if (Object.keys(manualDict).length > 0) {
        for (let cat in manualDict) {
          if (Object.values(manualDict[cat]).some(i => i.name === name)) {
            const map = { 
              weekly:'weekly',talent:'talent', weapon:'weapon', boss:'boss', gem:'gem', specialty:'specialty', 
              monster:'monster', normal:'normal', ore:'ore', wood:'wood', adventureItem:'adventureItem'
            }
            return map[cat] || 'other'
          }
        }
      }
      
      for (let [boss, items] of weeklyList) {
        if (items && items.includes(name)) return 'weekly'
      }

      let meta = Material.get(name)
      if (meta?.type && ['boss', 'gem', 'weapon', 'monster', 'normal', 'talent', 'specialty'].includes(meta.type)) {
        return meta.type
      }

      if (/的(教导|指引|哲学)$/.test(name)) return 'talent'

      let info = dict[item.id] || Object.values(dict).find(v => v.name === name)
      if (info?.parent) {
        let p = info.parent
        if (p.includes('特产')) return 'specialty'
        if (p.includes('矿物')) return 'ore'
        if (p.includes('武器突破')) return 'weapon'
        if (p.includes('角色培养')) return 'boss'
        if (p.includes('角色突破')) return 'gem'
        if (p.includes('收集物') || p.includes('宝箱') || p.includes('道具')) return 'adventureItem'
        if (p.includes('普通')) return 'normal'
        if (p.includes('精英') || p.includes('首领')) return 'monster'
        if (p.includes('角色与武器培养')) return 'monster'
        if (p.includes('木材')) return 'wood'
      }
      return 'other'
    }

    // 大地图接口
    try {
      let mapUrl = "https://api-takumi.mihoyo.com/common/map_user/ys_obc/v1/user/sync_game_material_info?map_id=2&app_sn=ys_obc&lang=zh-cn"
      let mapRes = await fetch(mapUrl, { headers: { "Cookie": ck, "Referer": "https://act.mihoyo.com" } }).then(res => res.json())
      if (mapRes?.retcode === 0) {
        for (let [id, num] of Object.entries(mapRes.data.material_info)) {
          if (num <= 0) continue
          let name = dict[id]?.name || Material.get(Number(id))?.name
          if (!name) continue
          
          let icon = dict[id]?.icon || ''
          let type = getDynamicType({ id: Number(id), name })
          mergedData.set(name, { id: Number(id), name, num, icon, type })
        }
      }
    } catch (e) {
      console.error('大地图接口错误:', e)
    }

    let region = (String(uid)[0] === '1' || String(uid)[0] === '2') ? 'cn_gf01' : 'cn_qd01'

    for (let file of ['avatarCompute.json', 'weaponCompute.json']) {
      try {
        let body = await this.getRemoteJson(file)
        if (!body) continue
        
        let silentE = { ...this.e, reply: () => {} }
        let res = await MysInfo.get(silentE, 'compute', { body: { ...body, uid: String(uid), region } })
        
        if (res?.retcode === 0 && res.data?.overall_consume) {
            res.data.overall_consume.forEach(val => {
              let owned = val.lack_num < 0 ? Math.abs(val.lack_num) + val.num : val.num - val.lack_num
              if (owned > 0) {
                if (mergedData.has(val.name)) {
                  // 数量不应累加，直接赋等值覆盖。彻底根除摩拉和所有材料的重复计算问题
                  mergedData.get(val.name).num = owned
                } else {
                  
                  let type = getDynamicType(val)
                  mergedData.set(val.name, { id: val.id, name: val.name, num: owned, icon: val.icon, type })
                }
              }
            })
          }
      } catch (e) {
        console.error(`处理 ${file} 时出错:`, e)
      }
    }

    let ret = { length: 0 }
    for (let item of mergedData.values()) {
      ret[item.type] ||= []; ret[item.type].push(item); ret.length++
    }
    for (let i in ret) { 
      if (Array.isArray(ret[i])) {
        ret[i].sort((a, b) => {
          // 给摩拉和智识之冕打装置顶权重
          let aTop = (a.name === '摩拉' || a.name === '智识之冕') ? 1 : 0
          let bTop = (b.name === '摩拉' || b.name === '智识之冕') ? 1 : 0
          
          if (aTop !== bTop) return bTop - aTop // 权重大者排前面
          return b.id - a.id // 如果都不是，或者都是，则继续按 ID 降序排列
        })
      } 
    }
    return ret
  }

  async getMapDict() {
    if (this.mapDict) return this.mapDict
    try {
      let url = "https://api-takumi.mihoyo.com/common/map_user/ys_obc/v1/map/label/tree?map_id=2&app_sn=ys_obc&lang=zh-cn"
      let res = await fetch(url).then(res => res.json())
      if (res?.retcode === 0) {
        let dict = {}
        
        const flatten = (nodes, parentPath) => {
          nodes.forEach(node => {
            let currentPath = [...parentPath, node.name]
            if (node.children && node.children.length > 0) {
              flatten(node.children, currentPath)
            } else {
              dict[node.id] = { name: node.name, icon: node.icon, parent: currentPath.join('-') }
            }
          })
        }
        flatten(res.data.tree, [])
        this.mapDict = dict
        return dict
      }
    } catch (e) {
      console.error('获取大地图字典报错:', e)
    }
    return {}
  }

  async getRemoteJson(fileName) {
    try {
      let url = `https://raw.githubusercontent.com/devil233-ui/GsMaterialPack/master/data/${fileName}`
      let res = await fetch(url) 
    //   let res = await fetch(url, {
    //     headers: { 'Authorization': `token ${this.GH_PAT}`, 'Accept': 'application/vnd.github.v3.raw' }
    //   })
      let text = await res.text()
      text = text.replace(/,\s*([\]}])/g, '$1') // 防呆，忽略多余逗号
      return JSON.parse(text)
    } catch (e) { 
      return null 
    }
  }

  async materialsWeekly() {
    if (this.e.isSr) return this.reply('该功能暂不支持星铁')
    let data = await this.getMaterialsData('weekly', false, false)
    if (!data) return
    
    let weeklyBossDict = await this.getRemoteJson('weeklyBoss.json')
    let weeklyList = Array.isArray(weeklyBossDict) ? weeklyBossDict : (weeklyBossDict?.data || [])
    
    if (!data?.materials?.weekly || weeklyList.length === 0) return this.reply('周本材料查询为空或字典获取失败')

    const { materials: { weekly } } = data
    const dataMap = new Map()
    const countMap = new Map()

    for (const item of weekly) {
      let bossName = null
      for (let [name, items] of weeklyList) {
        if (items && items.includes(item.name)) { bossName = name; break }
      }
      if (bossName) {
        if (!dataMap.has(bossName)) { dataMap.set(bossName, []); countMap.set(bossName, 0) }
        dataMap.get(bossName).push(item)
        countMap.set(bossName, countMap.get(bossName) + item.num)
      }
    }

    if (!dataMap.size) return this.reply('未找到匹配周本，请更新GitHub字典')
    data.weeklyList = [...dataMap.keys()].map(name => [name, countMap.get(name), dataMap.get(name)])
    
    let img = await puppeteer.screenshot('materialWeeklyPack', {
      ...data,
      tplFile: `./plugins/genshin/resources/html/materialPack/materialWeeklyPack.html`,
      pluResPath: `${this._path}/plugins/genshin/resources/`
    })
    if (img) await this.reply(img)
  }
}