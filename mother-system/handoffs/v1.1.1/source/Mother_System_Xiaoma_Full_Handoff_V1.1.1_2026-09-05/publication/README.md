# 本次实际发布状态

本包完整原件在 archives 与 sources 内保留。GitHub 中已发布 8 份交接文档，其中含分发状态索引；5 个仓库的通知 Issue 已创建。执行者的读取确认尚未取得，Animal、Plant、Brain/Jarvis 三组独立入口尚未确认。

全量原件 ZIP 还未推送。一次较小的执行包二进制上传返回的 Git blob 散列与本地文件不同，该对象已拒绝，未挂到任何分支，也未提供下载入口。完整本地原件不受影响。

PUBLICATION_STATUS.json 与 DISPATCH_LEDGER.json 记录已做与未做。远端只发布了开工文档和通知，不能据此宣称完整远端备份已经完成。后续全量发布成功时应另附实际提交、文件散列和读取验证，保留本次历史快照。

本包 tools/verify_package.py 是本地只读完整性检查工具。运行 `python tools/verify_package.py` 可检查清单、散列、JSON 和内层 ZIP。它不上传文件，不修改仓库，也不代表生产验收。
