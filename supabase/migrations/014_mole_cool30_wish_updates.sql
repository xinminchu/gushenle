-- 014_mole_cool30_wish_updates.sql
-- @麻牛 的两条留言处理完毕：打地鼠游戏已上线（采纳），沉思撞球回满规则已改（采纳）。
-- 站长 Mas 的公开回复随采纳一起写入，所有人可见。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

update game_wishes
set adopted = true,
    reply_text = '收到！「高管打地鼠」已经连夜上线啦🔨 真人高管头像有肖像权风险，我换成了卡通高管（系领带的地鼠CEO们），红色的利空地鼠千万别打哦。创意署名 @麻牛，许愿池+1！',
    replied_at = now()
where content = '来个打地鼠游戏吧，股票公司的高管做头像'
  and adopted is not true;

update game_wishes
set adopted = true,
    reply_text = '改好了！现在只有球掉地板上才回满砖块，接住了就靠本事清版——看看你的刷分纪录还保得住不😄 感谢火眼金睛！',
    replied_at = now()
where content = '沉思撞球的球掉地板上才回满吧，你现在是接住了就回满，那玩不完呀'
  and adopted is not true;
