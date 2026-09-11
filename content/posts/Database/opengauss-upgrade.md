+++
title = 'openGauss 升级'
date = '2025-03-06T18:25:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['openGauss']
weight = 900
ShowToc = true
TocOpen = true
+++
virtCCA

# 1 升级的流程

-   升级分类：

    -   就地升级：暂停业务
    -   灰度升级：不暂停业务，一次升级所有节点
    -   节点升级：基于灰度升级，可升级部分节点
-   升级流程：（此处的命令是简化版命令，不能直接执行）

    1.  准备升级：检查安装包
    2.  开始升级：停止、启动集群，修改系统表

        ```bash
        mkdir new_pkg
        gs_preinstall -X config.xml
        gs_upgradectl -t auto-upgrade -X config.xml --grey
        ```

    3.  验证升级

        ```bash
        gsql -V
        gaussdb -V
        gsql -d postgres -p 5432 -c 'select working_version_num();' # 旧版本
        ```

    4.  提交升级

        ```bash
        gs_upgradectl -t commit-upgrade -X config.xml --grey
        ```

    5.  回滚升级

        ```bash
        gs_upgradectl -t auto-rollback -X config.xml
        ```

# 2 升级的原理

## 安装包

```sql
|-- install
    |-- share
        |-- postgresql
            |--  postgresql.conf.sample
            |--  postgres.bki
            |-- system_views.sql
            |-- extension
            |-- ...
```

```python
main
    parseCommandLine
    checkParameter
    initGlobalInfos
        initClusterInfo
    UpgradeImplOLAP
    run
        Upgrade.run
        UpgradeImpl.run # UpgradeImpl.py
            initGlobalInfos
            commonCheck
            if 'auto_upgrade'
                doGreyBinaryUpgrade
                    distributeXml
                    checkUpgrade
                        # 检查环境变量
                        'Local_Check_Upgrade -t action -R oldapppath -l locallog -N newapppath -X config.xml'
                    doHealthCheck
                        checkClusterStatus
                        checkConnection
                    chooseUpgradeNodes
                    prepareGreyUpgrade
                        createBakPath
                            'mkdir upgradeBackupPath'
                        initNodeStepInCsv
                            'touch upgrade_step.csv_bak'
                        initUpgradeProcessStatus
                            recordNodeStepInplace
                        recordDirFile
                            'touch record_app_directory'
                            writeFile('oldClusterAppPath')
                        copyBakVersion
                            'cp oldapppath/bin/upgrade_version upgradeBackupPath/upgrade_version'
                    installNewBin
                        'Local_Install -t install_cluster -U user:group -R newapppath -P tmpdir -c clustername -l locallog -X config.cml -T -u'
                    cpDolphinUpgradeScript
                        'cp oldapppath/share/postgresql/extension/dolphin* newapppath/share/postgresql/extension/'
                    prepareUpgradeSqlFolder # catalog upgrade_sql.tar.gz, including guc
                        'Local_Upgrade_Utility -t prepare_upgrade_sql_folder -U user --upgrade_bak_path upgradeBackupPath -X config.xml -l locallog'
                    updateCatalog
                        'cp upgradeBackupPath/upgrade_sql/ {upgrade-post, upgrade, rollback-post, rollback}'
                        doUpgradeCatalog
                            setUpgradeFromParam
                                'gs_guc set -Z cmagent -N all -I all -c upgrade_from=working_grand_version'
                            reload_cm_proc
                            setUpgradeMode(2)
                            reloadCmAgent
                            killKernalSnapshotThread
                            execRollbackUpgradedCatalog('rollback')
                            execRollbackUpgradedCatalog('upgrade')
                            pgxcNodeUpdateLocalhost("upgrade")
                            rebuild_pg_proc_proname_args_nsp_new_index
                    upgradeAgain
                        greySyncGuc
                            'Local_Upgrade_Utility -t grey_sync_guc -U user --upgrade_bak_path=upgradeBackupPath -l logcallog'
                                greySyncGuc # script/local/UpgradeUtility.py
                                    readDeleteGuc
                                    greySyncInstanceGuc
                        greyUpgradeSyncOldConfigToNew
                            'Local_Upgrade_Utility -t grey_upgrade_config_sync -U user -V oldversionnumber --old_cluster_app_path=oldapppath --new_cluster_app_path=newapppath -l locallog'
                                greyUpgradeSyncConfig # 适配点, 参考 setUpradeModeGuc(

                        getOneDNInst
                        switchBin
                            'Local_Upgrade_Utility -t switch_bin -U user -l localog -R new?oldapppath'
                        restore_origin_disaster_user_file
                        setNewVersionGuc
                        switchExistsProcess
                            _check_and_start_cluster
                                'gs_om -t start'
                            createCheckpoint
                            switchDn
                            waitClusterNormalDegrade
                        doHealthCheck
                        waitClusterForNormal
                        backupGlobalRelmapFile
                        printPrecommitBannervstart
            elif 'commit':
                doGreyCommitUpgrade
```

# 参考

-   opengauss om源码：[https://gitee.com/opengauss/openGauss-OM](https://gitee.com/opengauss/openGauss-OM)
-   opengauss升级：[https://docs.opengauss.org/zh/docs/latest/docs/DatabaseOMGuide/upgrade.html](https://docs.opengauss.org/zh/docs/latest/docs/DatabaseOMGuide/upgrade.html)
