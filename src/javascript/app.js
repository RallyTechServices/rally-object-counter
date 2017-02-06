Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },
                        
//    launch: function() {
//        var me = this;
//        this.setLoading("Loading stuff...");
//
//        this.down('#message_box').update(this.getContext().getUser());
//        
//        var model_name = 'Defect',
//            field_names = ['Name','State'];
//        
//        this._loadAStoreWithAPromise(model_name, field_names).then({
//            scope: this,
//            success: function(store) {
//                this._displayGrid(store,field_names);
//            },
//            failure: function(error_message){
//                alert(error_message);
//            }
//        }).always(function() {
//            me.setLoading(false);
//        });
//    },
    launch: function() {
        var me = this;
        var types = { 
            'Attachment':'--',
            'BuildDefinition':'--',
            'Changeset':'--',
            'ConversationPost':'--',
            'Defect':'--',
            'DefectSuite':'--',
            'HierarchicalRequirement':'--',
            'Iteration':'--',
            'Milestone':'--',
            'PortfolioItem':'--',
            'PreliminaryEstimate':'--',
            'Project':'--',
            'ProjectPermission':'--',
            'Release':'--',
            'State':'--',
            'Tag':'--',
            'Task':'--',
            'TestCase':'--',
            'TestCaseResult':'--',
            'TestCaseStep':'--',
            'TestFolder':'--',
            'TestSet':'--',
            'User':'--'
        };  
    
        var tpl = me._getTemplate(types);
    
        var display_container = this.add({
            xtype:'container',
            tpl: tpl,
            margin: 10
        }); 
    
        Ext.Object.each(types, function(type_name){
            me._getCount(type_name,types,display_container);
        }); 
    },  

    _getTemplate:function(types){
        console.log('template for types:',types);
        var template_array = ['<p><b>Workspace</b>:' + this.getContext().getWorkspace().Name + '</p>'];
        Ext.Object.each( types, function(type_name) {
            template_array.push('<p><b>' + type_name + 's</b>: {' + type_name + '}</p>');
        }); 
        console.log(template_array);
        return new Ext.XTemplate(template_array);
    },  
    _getCount:function(type_name,types,display_container){
        types[type_name] = '--';
        display_container.update(types);
        Ext.create('Rally.data.WsapiDataStore',{
            model: type_name,
            limit: 1,
            pageSize: 1,
            autoLoad: true,
            context: { project: null },
            listeners: {
                load: function(store,records){
                    console.log(records.length);
                    types[type_name] = store.getTotalCount();
                    display_container.update(types);
                }   
            }   
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

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
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
    }
    
});
