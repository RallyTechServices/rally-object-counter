Ext.define("TSRallyObjectCounter", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box', layout: 'hbox'},
        {xtype:'container',itemId: 'message_box'},
        {xtype:'container',itemId:'display_box',layout:'fit'}
    ],

    integrationHeaders : {
        name : "TSRallyObjectCounter"
    },

    config: {
        defaultSettings: {
            countAllWorkspaces: true
        }
    },

    launch: function() {
        var me = this;
        this._setLoading('Loading...');
        this._getWorkspaces().then({
            success: function(workspaces) {
                var promises = Ext.Array.map(workspaces, function(workspace){
                    return function() { return me._countItemsInWorkspace(workspace); }
                });

                Deft.Chain.sequence(promises,this).then({
                    success: this._makeGrid,
                    failure: function(msg) {
                        Ext.Msg.alert("Problem Finding Counts", msg);
                    },
                    scope: this
                });
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem Finding Workspaces", msg);
            },
            scope: this
        });
    },

    _setLoading: function(msg) {
        this.logger.log('Loading:', msg);
        this.down('#message_box').removeAll();
        if ( msg === false ) {
            this.setLoading(false);
            return;
        }
        this.down('#message_box').add({xtype:'container',html:msg});
        this.setLoading(msg);
    },

// removed user and attachment because they kept timing out
    _getRecordTypesToCount: function() {
        return ['UserStory','Defect','Task','TestCase',
            'TestSet', 'PortfolioItem'];
    },

    _countItemsInWorkspace: function(workspace) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var types = this._getRecordTypesToCount();
        var status = 'Counting items in workspace ' + workspace.get('_refObjectName');

        this._setLoading(status);

        var promises = Ext.Array.map(types, function(type){
            return function() { return me._countItems(type,workspace); }
        });

        Deft.Chain.parallel(promises,this).then({
            success: function(results){
                var counts = {
                    Name: workspace.get('_refObjectName')
                };
                Ext.Array.each(results, function(result){
                    Ext.Object.each(result, function(key,value){
                        counts[key] = value;
                    });
                });
                deferred.resolve(counts);
            },
            failure: function(msg) {
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred.promise;
    },

    _countItems: function(type,workspace){
        var deferred = Ext.create('Deft.Deferred');
        var counts = {};
        var message = "Counting:" + type + " in " + workspace.get('_refObjectName');
        this._setLoading(message);

        Ext.create('Rally.data.wsapi.Store',{
            model: type,
            fetch: ['ObjectID'],
            limit: 1,
            pageSize: 1,
            autoLoad: true,
            context: {
                workspace: workspace.get('_ref'),
                project: null
            },
            listeners: {
                load: function(store,records){
                    counts[type] = store.getTotalCount();
                    deferred.resolve(counts);
                }
            }
        });
        return deferred.promise;
    },

    _getWorkspaces: function() {
        var deferred = Ext.create('Deft.Deferred');
        var all_workspaces = this.getSetting('countAllWorkspaces');
        this._getSubscription().then({
            success: function(sub) {
                sub[0].getCollection('Workspaces').load({
                    fetch: ['ObjectID','Name'],
                    callback: function(workspaces,operation,success){
                        deferred.resolve(workspaces);
                    }
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        this.logger.log('Count All:', all_workspaces);
        return deferred.promise;
    },

    _getSubscription: function() {
        return this._loadWsapiRecords({
            model:'Subscription',
            fetch: ['Name','Workspaces']
        });
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _getColumns: function() {
        var column_names = Ext.Array.merge(['Name'],this._getRecordTypesToCount());
        return Ext.Array.map(column_names, function(name){
            return { dataIndex: name, text: name };
        });
    },

    _makeGrid: function(results){
        var store = Ext.create('Rally.data.custom.Store',{
            data: results,
            pageSize: 500
        });

        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this._getColumns(),
            showPagingToolbar: false,
            showRowActionsColumn: false
        });
        this._addSelectors();
        this._setLoading(false);
    },

    _addSelectors: function() {
        this.down('#selector_box').add({
            xtype:'container',
            flex: 1
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            iconCls: 'icon-export',
            itemId: 'btExport',
            cls: 'rly-small primary',
            disabled: false,
            margin: 5,
            listeners: {
                scope: this,
                click: this._exportData
            }
        });
    },

    _exportData: function() {
        var grid = this.down('rallygrid');
        var csv = [];
        var data = grid.getStore().getData().items;
        console.log('data', data);

        var headers = Ext.Array.merge(['Name'],this._getRecordTypesToCount());
        csv.push(headers.join(','));
        Ext.Array.each(data, function(s){
            var row = Ext.Array.map(headers, function(field){
                return s.get(field);
            });
            csv.push(row.join(','));
        });
        csv = csv.join("\r\n");

        CArABU.technicalservices.Exporter.saveCSVToFile(csv, Ext.String.format('counts.csv'));
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },

    getSettingsFields: function() {
        var check_box_margins = 15;
        return [
            {
                name: 'countAllWorkspaces',
                xtype:'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: check_box_margins,
                boxLabel: 'Count in All Workspaces<br/><span style="color:#999999;"><i>Only includes open workspaces and open projects.</i></span>'
            }
        ];
    }

});
