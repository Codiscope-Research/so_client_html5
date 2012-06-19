/* SpiderOak html5 client Main app.

 * Works with:
 * - jquery.mobile-1.0.1.css
 * - jquery-1.6.4.js
 * - jquery.mobile-1.0.1.js
 * - js_aux/misc.js - b32encode_trim(), blather(), fragment_quote(),
 *                    error_alert()
 * - custom-scripting.js - jqm settings and contextual configuration
 */

/*
  NOTES

  - Content visits:
    We intercept navigation to content (eg, $.mobile.changePage) repository
    URLs and intervene via binding of handle_content_visit to jQuery mobile
    "pagebeforechange" event. URLs included as href links must start with
    '#' to trigger jQuery Mobile's navigation detection, which by default
    tracks changes to location.hash.  handle_content_visit() dispatches those
    URLs it receives that reside within the ones satisfy .is_content_root_url(),
    to which the root URLs are registered by the root visiting routines.

  - My routines which return jQuery objects end in '$', and - following common
    practice - my variables intended to contain jQuery objects start with '$'.
*/

// For misc.js:blather() and allowing dangerous stuff only during debugging.
SO_DEBUGGING = true;

var spideroak = function () {
    /* SpiderOak application object, as a modular singleton. */
    "use strict";               // ECMAScript 5


    /* Private elements: */

    /* ==== Object-wide settings ===== */

    var defaults = {
        /* Settings not specific to a particular login session: */
        // API v1.
        // XXX base_host_url may vary according to brand package.
        base_host_url: "https://spideroak.com",
        combo_root_url: "https://home",
        storage_login_path: "/browse/login",
        storage_logout_suffix: "logout",
        storage_path_prefix: "/storage/",
        original_shares_path_suffix: "shares",
        public_shares_path_suffix: "/share/",
        content_page_template_id: "content-page-template",
        devices_query_expression: 'device_info=yes',
        versions_query_expression: 'format=version_info',
        home_page_id: 'home',
        root_storage_node_label: "Devices",
        preview_sizes: [25, 48, 228, 800],
        dividers_threshold: 10,
        filter_threshold: 20,
    };
    var my = {
        /* Login session settings: */
        username: null,
        storage_web_url: null,  // Location of storage web UI for user.
        storage_root_url: null,
        original_shares_root_url: null,
        // All the service's actual shares reside within:
        actual_shares_root_url: defaults.base_host_url + "/share/",
        public_share_room_urls: {},
        original_share_room_urls: {},
    };

    /* Navigation handlers: */

    function handle_content_visit(e, data) {
        /* Intercept URL visits and intervene for repository content. */
        if ((typeof data.toPage === "string")
            && is_content_url(data.toPage)) {
            e.preventDefault();
            var mode_opts = query_params(data.toPage);
            content_node_manager.get(data.toPage).visit(data.options,
                                                        mode_opts); }}
    function establish_traversal_handler() {
        /* Establish page change event handler. */
        $(document).bind("pagebeforechange.SpiderOak", handle_content_visit);
    }


    /*  ===== Content Root Registration =====  */

    function set_storage_account(username, storage_host, storage_web_url) {
        /* Register confirmed user-specific storage details.  Return the
           storage root URL.
           'username' - the account name
           'storage_host' - the server for the account
           'storage_web_url' - the account's web UI entry address
        */

        var storage_url = register_storage_root(storage_host, username,
                                                storage_web_url);
        if (! is_content_root_url(storage_url)) {
            register_content_root_url(storage_url); }

        if (remember_manager.active()) {
            remember_manager.store({username: username,
                                    storage_host: storage_host,
                                    storage_web_url: storage_web_url}); }

        // Now let's direct the caller to the combo root:
        return my.combo_root_url; }
    function clear_storage_account() {
        /* Obliterate internal settings and all content nodes for a clean slate.
           All share artifacts, original and public, are removed, as well
           as registered storage.  We do not remove persistent settings. */

        // Empty strings instead of null to distinguish from initial settings.

        if (my.original_shares_root_url) {
            content_node_manager.clear_hierarchy(my.original_shares_root_url); }
        my.original_shares_root_url = "";
        if (my.storage_root_url) {
            content_node_manager.clear_hierarchy(my.storage_root_url); }
        my.storage_root_url = "";

        content_node_manager.free(content_node_manager.get_combo_root());

        my.username = "";
        my.storage_host = "";
        my.storage_web_url = ""; }

    function add_public_share_room(shareid, password, host) {
        /* Register a public share room in the public share root, returning URL.
             'username': the account name
             'host': the server for the account
             'storage_path_prefix': the leading part of the storage path
        */

        var root = content_node_manager.get(my.actual_shares_root_url);
        var url = (root.url + b32encode_trim(shareid) + "/" + password + "/");
        register_public_share_room_url(url);
        content_node_manager.get(url, root);
        return url;
    }


    /* ===== Node-independent content URL categorization ===== */

    // Managed content is organized within two content roots:
    //
    // - the storage root, my.storage_root_url, determined by the user's account
    // - the public share root, which is the same across all accounts
    //
    // There is also a collection of the shares originated by the account,
    // in the OriginalSharesRoot.  Like all shares, the URLs of the items
    // it contains reside among the public shares.
    //
    // Content urls are recognized by virtue of beginning with one of the
    // registered content roots. The storage root is registered when the user
    // logs in. The share rooms root is registered upon the registration of
    // any share room.

    function register_storage_root(host, username, storage_web_url) {
        /* Identify user's storage root according to 'host' and 'username'.
           The account's 'storage_web_url' is also conveyed.
           Return the url. */
        my.username = username;
        my.storage_host = host;
        my.storage_web_url = storage_web_url;

        my.storage_root_url = (host
                               + defaults.storage_path_prefix
                               + b32encode_trim(username)
                               + "/");
        // Original root is determined by storage root:
        register_original_shares_root();

        return my.storage_root_url;
    }
    function register_original_shares_root() {
        /* Identify original share rooms root url. Depends on established
           storage root.  Return the url. */
        my.original_shares_root_url =
            (my.storage_root_url + defaults.original_shares_path_suffix); }
    function register_public_share_room_url(url) {
        /* Include url among the registered public rooms.  Returns the url. */
        my.public_share_room_urls[url] = true;
        return url; }
    function register_original_share_room_url(url) {
        /* Include url among the registered original rooms.  Returns the url. */
        my.original_share_room_urls[url] = true;
        return url; }
    function is_combo_root_url(url) {
        return (url === my.combo_root_url); }
    function is_content_root_url(url) {
        /* True if the 'url' is for one of the root content items.
           Doesn't depend on the url having an established node. */
        return ((url === my.combo_root_url)
                || (url === my.storage_root_url)
                || (url === my.original_shares_root_url)
                || (url === my.actual_shares_root_url)); }
    function is_public_share_room_url(url) {
        /* True if the 'url' is for one of the familiar public share rooms.
           Doesn't depend on the url having an established node. */
        return (my.public_share_room_urls.hasOwnProperty(url)); }
    function is_original_share_room_url(url) {
        /* True if the 'url' is for one of the original share rooms.
           Doesn't depend on the url having an established node. */
        return (my.original_share_room_urls.hasOwnProperty(url)); }
    function is_storage_url(url) {
        /* True if the URL is for a content item in the user's storage area.
           Doesn't depend on the url having an established node. */
        return (my.storage_root_url
                && (url.slice(0, my.storage_root_url.length)
                    === my.storage_root_url)); }
    function is_share_url(url) {
        /* True if the URL is for a content item in the user's storage area.
           Doesn't depend on the url having an established node. */
        return (my.actual_shares_root_url
                && (url.slice(0, my.actual_shares_root_url.length)
                    === my.actual_shares_root_url)); }
    function is_content_url(url) {
        /* True if url within registered content roots. */
        return (is_storage_url(url)
                || is_share_url(url)
                || is_combo_root_url(url)); }


    /* ===== Data model ===== */

    /* SpiderOak content includes storage (backups) and share rooms. The
       data model distinguishes different kinds of those things - the
       roots, devices, folders, and files - and wraps them in abstract
       general types - the ContentNode and variants of it, where useful. */

    function ContentNode(url, parent) {
        /* Constructor for items representing stored content.
           - 'url' is absolute URL for the collection's root (top) node.
           - 'parent' is containing node. The root's parent is null.
           See JSON data examples towards the bottom of this script.
        */
        if ( !(this instanceof ContentNode) ) {      // Coding failsafe.
            throw new Error("Constructor called as a function");
        }
        if (url) {             // Skip if we're in prototype assignment.
            this.url = url;
            this.root_url = parent ? parent.root_url : url;
            this.query_qualifier = "";
            this.parent_url = parent ? parent.url : null;
            this.is_container = true; // Typically.
            this.subdirs = [];  // Urls of contained devices, folders.
            this.files = [];    // Urls of contained files.
            this.$page = null;  // This node's jQuery-ified DOM data-role="page"
            this.lastfetched = false;
            this.emblem = "";   // At least for debugging/.toString()
            this.icon_path = ""; }}
    ContentNode.prototype.free = function () {
        /* Free composite content to make available for garbage collection. */
        if (this.$page) {
            this.$page.remove();
            this.$page = null; }}

    function StorageNode(url, parent) {
        ContentNode.call(this, url, parent);
        // All but the root storage nodes are contained within a device.
        // The DeviceStorageNode sets the device url, which will trickle
        // down to all its contents.
        this.device_url = parent ? parent.device_url : null; }
    StorageNode.prototype = new ContentNode();
    function ShareNode(url, parent) {
        /* Share room abstract prototype for collections, rooms, and contents */
        ContentNode.call(this, url, parent);
        this.root_url = parent ? parent.root_url : null;
        this.room_url = parent ? parent.room_url : null; }
    ShareNode.prototype = new ContentNode();

    function RootContentNode(url, parent) {
        /* Consolidated root of the storage and share content hierarchies. */
        ContentNode.call(this, url, parent);
        this.root_url = url;
        this.emblem = "Root";
        this.name = "Dashboard";
        delete this.subdirs;
        delete this.files; }
    RootContentNode.prototype = new ContentNode();
    RootContentNode.prototype.free = function () {
        /* Free composite content to make available for garbage collection. */
        if (this.$page) {
            // Do not .remove() the page - it's the original, not a clone.
            this.$page = null; }}
    RootContentNode.prototype.loggedin_ish = function () {
        /* True if we have enough info to be able to use session credentials. */
        return (my.username && true); }

    function RootStorageNode(url, parent) {
        StorageNode.call(this, url, parent);
        this.query_qualifier = "?" + defaults.devices_query_expression;
        this.emblem = "Root Storage";
        this.stats = null;
        delete this.files; }
    RootStorageNode.prototype = new StorageNode();
    function RootShareNode(url, parent) {
        ShareNode.call(this, url, this);
        this.emblem = "Root Share";
        this.root_url = url; }
    RootShareNode.prototype = new ShareNode();
    function PublicRootShareNode(url, parent) {
        RootShareNode.call(this, url, parent);
        this.name = "Public Share Rooms";
        this.emblem = "Familiar Public Share Rooms"; }
    OriginalRootShareNode.prototype = new RootShareNode();
    function OriginalRootShareNode(url, parent) {
        RootShareNode.call(this, url, parent);
        this.name = "My Share Rooms";
        this.emblem = "Originally Published Share Rooms"; }
    PublicRootShareNode.prototype = new RootShareNode();

    function DeviceStorageNode(url, parent) {
        StorageNode.call(this, url, parent);
        this.emblem = "Storage Device";
        this.device_url = url; }
    DeviceStorageNode.prototype = new StorageNode();
    function RoomShareNode(url, parent) {
        ShareNode.call(this, url, parent);
        this.emblem = "Share Room";
        this.room_url = url; }
    RoomShareNode.prototype = new ShareNode();

    function FolderContentNode(url, parent) {
        /* Stub, for situating intermediary methods. */ }
    function FileContentNode(url, parent) {
        /* Stub, for situating intermediary methods. */ }

    function FolderStorageNode(url, parent) {
        this.emblem = "Storage Folder";
        StorageNode.call(this, url, parent); }
    FolderStorageNode.prototype = new StorageNode();
    function FolderShareNode(url, parent) {
        this.emblem = "Share Room Folder";
        ShareNode.call(this, url, parent); }
    FolderShareNode.prototype = new ShareNode();

    function FileStorageNode(url, parent) {
        this.emblem = "Storage File";
        StorageNode.call(this, url, parent);
        this.is_container = false;
        delete this.subdirs;
        delete this.files; }
    FileStorageNode.prototype = new StorageNode();
    function FileShareNode(url, parent) {
        this.emblem = "Share Room File";
        ShareNode.call(this, url, parent);
        this.is_container = false;
        delete this.subdirs;
        delete this.files; }
    FileShareNode.prototype = new ShareNode();

    /* ===== Content type and role predicates ===== */

    ContentNode.prototype.is_root = function () {
        /* True if the node is a collections top-level item. */
        return (this.url === this.root_url); }

    ContentNode.prototype.is_device = function() {
        return false; }
    DeviceStorageNode.prototype.is_device = function() {
        return true; }

    /* ===== Remote data access ===== */

    ContentNode.prototype.visit = function (chngpg_opts, mode_opts) {
        /* Fetch current data from server, provision, layout, and present.
           'chngpg_opts': framework changePage() options,
           'mode_opts': node provisioning and layout modal settings. */

        if (! this.up_to_date()) {
            this.fetch_and_dispatch(chngpg_opts, mode_opts); }
        else {
            this.show(chngpg_opts, mode_opts); }}

    ContentNode.prototype.fetch_and_dispatch = function (chngpg_opts,
                                                         mode_opts) {
        /* Retrieve this node's data and deploy it.
           'chngpg_opts' - Options for the framework's changePage function
           'mode_opts': node provisioning and layout modal settings.

           - On success, call this.handle_visit_success() with the retrieved
             JSON data, new Date() just prior to the retrieval, chngpg_opts,
             mode_opts, a text status categorization, and the XMLHttpRequest
             object.
           - Otherwise, this.handle_visit_failure() is called with the
             XMLHttpResponse object, chngpg_opts, mode_opts, the text status
             categorization, and an exception object, present if an exception
             was caught.

           See the jQuery.ajax() documentation for XMLHttpResponse details.
        */

        var when = new Date();
        var url = this.url + this.query_qualifier;
        $.ajax({url: url,
                type: 'GET',
                dataType: 'json',
                cache: false,
                success: function (data, status, xhr) {
                    this.handle_visit_success(data, when,
                                              chngpg_opts, mode_opts,
                                              status, xhr); }.bind(this),
                error: function (xhr, statusText, thrown) {
                    this.handle_visit_failure(xhr, chngpg_opts, mode_opts,
                                              statusText,
                                              thrown)}.bind(this), })};

    RootContentNode.prototype.visit = function (chngpg_opts, mode_opts) {
        /* Do the special visit of the consolidated storage/share root. */

        // Trigger visits to the respective root content nodes in 'passive'
        // mode so they do not focus the browser on themselves. 'notify' mode
        // is also provoked, so they report their success or failure to our
        // notify_subvisit_status() method.
        //
        // See docs/AppOverview.txt "Content Node navigation modes" for
        // details about mode controls.

        this.veil(true);

        this.layout_header();

        if (! this.loggedin_ish()) {
            // Not enough registered info to try authenticating:
            this.authenticated(false);
            this.show(chngpg_opts, {}); }
        else {
            var storage_root = content_node_manager.get(my.storage_root_url);
            var our_mode_opts = {passive: true,
                                 notify_callback:
                                     this.notify_subvisit_status.bind(this),
                                 notify_token: 'storage'};
            $.extend(our_mode_opts, mode_opts);
            try {
                // Will chain via notify_callback:
                storage_root.visit(chngpg_opts, our_mode_opts); }
            catch (err) {
                // XXX These failsafes should be in error handlers:
                this.authenticated(false,
                                   {status: 0, statusText: "System error"},
                                   err); }
            // XXX Populate the familiar public share rooms.
            // XXX Provide public share edit and "+" add controls - somewhere.
            }}

    RootContentNode.prototype.notify_subvisit_status = function(succeeded,
                                                                token,
                                                                content) {
        /* Callback passed to subordinate root content nodes to signal their
           update disposition:
           'succeeded': true for success, false for failure.
           'token': token they were passed to identify the transaction,
           'content': on success: the jquery $(dom) for the populated content,
                      for failure: the resulting XHR object. */

        this.authenticated(true);

        $.mobile.hidePageLoadingMsg();
        var $page = this.my_page$();
        var selector = ((token === 'storage')
                        ? "#my-storage-leader"
                        : "#my-rooms-leader")
        var $leader = $(selector);

        if (! succeeded) {
            $(selector + " + li").remove(); // Remove the leader's li siblings.
            // TODO Make pretty:
            $leader.after($('<li/>').html('<p> <em> Error: '
                                          + content.statusText
                                          + '</em> </p>'));
            if (token === "storage") {
                this.authenticated(false, content);
                this.show({}, {}); }}
        else {
            // Inject the duplicated content and show it, or hide the
            // section if empty:
            $(selector + " ~ li").remove(); // Remove the leader's li siblings.
            var $children = content.children();
            if ($children.length) {
                $(selector).after($children); }
            else {
                // TODO Make pretty:
                $leader.after($('<li title="Empty"/>')
                              .html('<em>&nbsp;&nbsp;&nbsp;'
                                    + '&nbsp;&empty; </em>')); }
            if (token === 'storage') {
                // Ensure we're current page and chain to original shares root.

                this.show({}, {});

                var our_mode_opts = {passive: true,
                                     notify_callback:
                                       this.notify_subvisit_status.bind(this),
                                     notify_token: 'original-share'};
                $('.nav_login_storage').fadeIn();
                this.authenticated(true, content);
                var ps_root = cnmgr.get(my.original_shares_root_url, this);
                ps_root.visit({}, our_mode_opts); }}}

    ContentNode.prototype.handle_visit_success = function (data, when,
                                                           chngpg_opts,
                                                           mode_opts,
                                                           status, xhr) {
        /* Deploy successfully obtained node data.
           See ContentNode.fetch_and_dispatch() for parameter details. */
        this.provision(data, when, mode_opts);
        this.layout(mode_opts);
        this.show(chngpg_opts, mode_opts);
        if (mode_opts.notify_callback) {
            var cloned_listview = this.my_contents_listview$().clone(true);
            mode_opts.notify_callback(true,
                                      mode_opts.notify_token,
                                      cloned_listview); }}

    ContentNode.prototype.handle_visit_failure = function (xhr,
                                                           chngpg_opts,
                                                           mode_opts,
                                                           exception) {
        /* Do failed visit error handling with 'xhr' XMLHttpResponse report. */
        if (mode_opts.notify_callback) {
            mode_opts.notify_callback(false, mode_opts.notify_token, xhr); }
        else {
            $.mobile.hidePageLoadingMsg();
            alert("Visit '" + this.name + "' failed: "
                  + xhr.statusText + " (" + xhr.status + ")");
            var combo_root = content_node_manager.get_combo_root();
            if (! is_combo_root_url(this.url)) {
                // Recover upwards, eventually to the top:
                $.mobile.changePage(this.parent_url
                                    ? this.parent_url
                                    : combo_root.url); }}}

    RootContentNode.prototype.handle_visit_failure = function (xhr,
                                                               chngpg_opts,
                                                               mode_opts,
                                                               exception) {
        /* Do failed visit error handling with 'xhr' XMLHttpResponse report. */
        this.authenticated(false, xhr, exception); }

    RootContentNode.prototype.authenticated = function (succeeded, content,
                                                        exception) {
        /* Present login challenge versus content, depending on access success.
           'succeeded': true for success, false for failure.
           'content': on success: the jquery $(dom) for the populated content,
                      for failure: the resulting XHR object, if any.
           'exception': on failure, exception caught by ajax machinery, if any.
         */
        var $page = this.my_page$();
        var $content_section = $page.find('.my-content-section');
        var $login_section = $page.find('.login-section');
        if (succeeded) {
            $login_section.hide(0);
            $content_section.fadeIn('fast');
            if (remember_manager.active()) {
                // remember_manager will store just the relevant fields.
                remember_manager.store(my);
                this.layout_header(); }}
        else {
            // Include the xhr.statusText in the form.
            this.veil(false);
            var $status = $page.find('.error-status-message');
            if (content) {
                var error_message = content.statusText;
                if (exception) {
                    error_message += " - " + exception.message; }
                $status.text(error_message);
                $status.show();
                if (content.status === 401) {
                    // Unauthorized - expunge all privileged info:
                    clear_storage_account(); }}
            else { $status.hide(); }
            // Hide the storage and original shares sections
            $content_section.hide();
            // Show the form
            $login_section.fadeIn('fast'); }}


    /* ===== Containment ===== */
    /* For content_node_manager.clear_hierarchy() */

    ContentNode.prototype.contained_urls = function () {
        return [].concat(this.subdirs, this.files); }
    RootContentNode.prototype.contained_urls = function () {
        return [].concat(this.storage_devices,
                         this.original_shares, this.public_shares); }
    RootStorageNode.prototype.contained_urls = function () {
        return [].concat(this.subdirs); }
    FileStorageNode.prototype.contained_urls = function () {
        return []; }
    FileShareNode.prototype.contained_urls = function () {
        return []; }


    /* "Provisioning": Data model assimilation of fetched data */

    ContentNode.prototype.provision = function (data, when, mode_opts) {
        /* Populate node with JSON 'data'. 'when' is the data's current-ness.
           'when' should be no more recent than the XMLHttpRequest.
        */
        this.provision_preliminaries(data, when, mode_opts);
        this.provision_populate(data, when, mode_opts); }

    ContentNode.prototype.provision_preliminaries = function (data, when,
                                                              mode_opts) {
        /* Do provisioning stuff generally useful for derived types. */
        if (! when) {
            throw new Error("Node provisioning without reliable time stamp.");
        }
        this.up_to_date(when); }

    ContentNode.prototype.provision_populate = function (data, when,
                                                         mode_opts) {
        /* Stub, must be overridden by type-specific provisionings. */
        error_alert("Not yet implemented",
                    this.emblem
                    + " type-specific provisioning implementation"); }

    ContentNode.prototype.provision_items = function (data_items,
                                                      this_container,
                                                      url_base, url_element,
                                                      trailing_slash,
                                                      fields,
                                                      contents_parent) {
        /* Register data item fields into subnodes of this node:
           'data_items' - the object to iterate over for the data,
           'this_container' - the container into which to place the subnodes,
           'url_base' - the base url onto which the url_element is appended,
           'url_element' - the field name for the url of item within this node,
           'trailing_slash' - true: url is given a trailing slash if absent,
           'fields' - an array of field names for properties to be copied (1),
           'contents_parent' - the node to attribute as the subnodes parent (2).

           (1) Fields are either strings, denoting the same attribute name in
               the data item and subnode, or two element subarrays, with the
               first element being the data attribute name and the second being
               the attribute name for the subnode.
           (2) The contained item's parent is not always this object, eg for
               the content roots. */
        var parent = content_node_manager.get(contents_parent);
        data_items.map(function (item) {
            var url = url_base + item[url_element];
            if (trailing_slash && (url.slice(url.length-1) !== '/')) {
                url += "/"; }
            var subnode = content_node_manager.get(url, parent);
            fields.map(function (field) {
                if (field instanceof Array) {
                    subnode[field[1]] = item[field[0]]; }
                else {
                    subnode[field] = item[field]; }})
            // TODO Scaling - make subdirs an object for hashed lookup.
            if (this_container.indexOf(url) === -1) {
                this_container.push(url); }})}

    RootStorageNode.prototype.provision_populate = function (data, when,
                                                             mode_opts) {
        /* Embody the root storage node with 'data'.
           'when' is time soon before data was fetched. */
        var combo_root = content_node_manager.get_combo_root();
        var url, dev, devdata;

        // XXX ?:
        this.name = my.username;
        // TODO: We'll cook stats when UI is ready.
        this.stats = data["stats"];

        this.subdirs = [];
        this.provision_items(data.devices, this.subdirs,
                             this.url, 'encoded', true,
                             ['name', 'lastlogin', 'lastcommit'],
                             my.combo_root_url);

        this.lastfetched = when; }

    FolderContentNode.prototype.provision_populate = function (data, when) {
        /* Embody folder content items with 'data'.
           'when' is time soon before data was fetched. */

        this.subdirs = [];
        this.provision_items(data.dirs, this.subdirs, this.url, 1, true,
                             [[0, 'name']], this.url);

        if (data.hasOwnProperty('files')) {
            this.files = [];
            var fields = ['name', 'size', 'ctime', 'mtime', 'versions'];
            defaults.preview_sizes.map(function (size) {
                /* Add previews, if any, to the fields. */
                if (("preview_" + size) in data.files) {
                    fields.push("preview_" + size); }})
            this.provision_items(data.files, this.files, this.url, 'url', false,
                                 fields, this.url); }

        this.lastfetched = when; }

    OriginalRootShareNode.prototype.provision_populate = function (data, when) {
        /* Embody the root share room with 'data'.
           'when' is time soon before data was fetched. */
        this.subdirs = [];
        var room_base = my.actual_shares_root_url + data.share_id_b32 + "/";
        this.provision_items(data.share_rooms, this.subdirs,
                             room_base, 'room_key', true,
                             [['room_name', 'name'],
                              ['room_description', 'description'],
                              'room_key', 'share_id'],
                             my.combo_root_url);
        this.subdirs.map(function (url) {
            /* Ensure the contained rooms urls are registered as originals. */
            register_original_share_room_url(url); });

        this.lastfetched = when; }

    PublicRootShareNode.prototype.provision_populate = function (data, when) {
        /* Embody the public root share room with 'data'.
           'when' is time soon before data was fetched. */
        var combo_root = content_node_manager.get_combo_root();
        var url, dev, devdata;
        this.name = "Public Share Rooms Container";

        for (room_url in my.public_share_rooms_urls) {
            if (my.public_share_rooms_urls.hasOwnProperty(room_url)) {
                data.dirs.push([content_node_manager.get(room_url, combo_root),
                                room_url]); }}

        this.provision_items(data.share_rooms, this.subdirs,
                             room_base, 'room_key', true,
                             [['room_name', 'name'],
                              ['room_description', 'description'],
                              'room_key', 'share_id'],
                             my.combo_root_url);

        this.lastfetched = when; }

    DeviceStorageNode.prototype.provision_populate = function (data, when) {
        /* Embody storage folder items with 'data'.
           'when' is time soon before data was fetched. */
        FolderStorageNode.prototype.provision_populate.call(this, data, when); }
    RoomShareNode.prototype.provision_populate = function (data, when) {
        /* Embody storage folder items with 'data'.
           'when' is time soon before data was fetched. */
        FolderShareNode.prototype.provision_populate.call(this, data,
                                                              when);
        this.name = data.stats.room_name;
        this.description = data.stats.description;
        this.number_of_files = data.stats.number_of_files;
        this.number_of_folders = data.stats.number_of_folders;
        this.firstname = data.stats.firstname;
        this.lastname = data.stats.lastname;
        this.lastfetched = when; }

    FolderStorageNode.prototype.provision_populate = function (data, when) {
        /* Embody storage folder items with 'data'.
           'when' is time soon before data was fetched. */
        FolderContentNode.prototype.provision_populate.call(this, data, when); }
    FolderShareNode.prototype.provision_populate = function (data, when){
        /* Embody share room folder items with 'data'.
           'when' is time soon before data was fetched. */
        FolderContentNode.prototype.provision_populate.call(this, data, when); }
    FileStorageNode.prototype.provision_populate = function (data, when) {
        error_alert("Not yet implemented", "File preview"); }

    ContentNode.prototype.up_to_date = function (when) {
        /* True if provisioned data is considered current.
           Optional 'when' specifies (new) time we were fetched. */
        // The generic case offers no shortcut for determining up-to-date-ness.
        if (when) { this.lastfetched = when; }
        if (! this.lastfetched) { return false; }
        // No intelligence yet.
        return false; }


    /* ===== Content node page presentation ===== */

    ContentNode.prototype.my_page_id = function () {
        /* Set the UI page id, escaping special characters as necessary. */
        return this.url; }
    RootContentNode.prototype.my_page_id = function () {
        /* Set the UI page id, escaping special characters as necessary. */
        return "home"; }
    ContentNode.prototype.show = function (chngpg_opts, mode_opts) {
        /* Trigger UI focus on our content layout.
           If mode_opts "passive" === true, don't do a changePage.
         */
        var $page = this.my_page$();
        if ($.mobile.activePage
            && ($.mobile.activePage[0].id !== this.my_page_id())
            && (!mode_opts.passive)) {
            $.mobile.changePage($page, chngpg_opts); }
        // Just in case, eg of refresh:
        $.mobile.hidePageLoadingMsg(); }

    ContentNode.prototype.layout = function (mode_opts) {
        /* Deploy content as markup on our page. */
        this.layout_header(mode_opts);
        this.layout_content(mode_opts);
        this.layout_footer(mode_opts);
    }

    ContentNode.prototype.layout_header_fields = function(fields) {
        /* Populate this content node's page header with these fields settings:
           field.title: html (or just text) with the page label;
           left_url: left-hand button URL; if absent left button not changed;
           left_label: text for left-hand button, or empty to hide the button;
                       left_label = "-" => use the login URL;
           right_url: right-hand button URL; if absent right button not changed;
           right_label: text for right-hand button, or empty to hide the button;
        */
        var $header = this.my_page$().find('[data-role="header"]');
        var $label;

        if (fields.hasOwnProperty('title')) {
            $header.find('.header-title').html(elide(fields.title, 25)); }

        if (fields.hasOwnProperty('right_url')) {
            var $right_slot = $header.find('.header-right-slot');
            $right_slot.attr('href', fields.right_url);
            if (fields.hasOwnProperty('right_label')) {
                if (! fields.right_label) {
                    $right_slot.hide(); }
                else {
                    replace_button_text($right_slot, elide(fields.right_label,
                                                           15));
                    $right_slot.show(); }}}

        if (fields.hasOwnProperty('left_url')) {
            var $left_slot = $header.find('.header-left-slot');
            if (fields.left_url === "-") {
                var parsed = $.mobile.path.parseUrl(window.location.href);
                fields.left_url = parsed.hrefNoHash; }
            $left_slot.attr('href', fields.left_url);
            if (fields.hasOwnProperty('left_label')) {
                if (! fields.left_label) {
                    $left_slot.hide(); }
                else {
                    replace_button_text($left_slot, elide(fields.left_label,
                                                          15));
                    $left_slot.show(); }}}}

    RootContentNode.prototype.layout_header = function (mode_opts) {
        /* Do special RootContentNode header layout. */
        var $header = this.my_page$().find('[data-role="header"]');
        var $logout_button = $header.find('.logout-button');
        if (! this.loggedin_ish()) {
            $logout_button.hide(); }
        else {
            // Only add the click handler if not already present!
            var events = $logout_button.data("events");
            if (! (events && events.hasOwnProperty("click"))) {
                $logout_button.bind("click",
                                    function (eventObj) {
                                        storage_logout(); })};
            $logout_button.show();
        }}

    StorageNode.prototype.layout_header = function(mode_opts) {
        /* Fill in typical values for header fields of .my_page$().
           Many storage node types will use these values as is, some will
           replace them.
         */
        var fields = {};
        fields.right_url = ('#' + add_query_param(this.url,
                                                  "refresh", "true", true));
        fields.right_label = "Refresh";
        fields.title = this.name;
        if (this.parent_url) {
            var container = content_node_manager.get(this.parent_url);
            fields.left_url = '#' + this.parent_url;
            fields.left_label = container.name; }
        this.layout_header_fields(fields); }
    RootStorageNode.prototype.layout_header = function(mode_opts) {
        /* Fill in typical values for header fields of .my_page$(). */
        StorageNode.prototype.layout_header.call(this, mode_opts);
        this.layout_header_fields({'title': "Storage Devices",
                                   'left_label': "Home",
                                   // XXX use from the combo-root, instead:
                                   'left_url': "#" + this.parent_url}); }

    ShareNode.prototype.layout_header = function(mode_opts) {
        /* Fill in header fields of .my_page$(). */
        var fields = {};
        if (this.parent_url) {
            var container = content_node_manager.get(this.parent_url);
            fields.right_url = '#' + add_query_param(this.url,"refresh","true");
            fields.right_label = "Refresh"
            fields.left_url = '#' + this.parent_url;
            fields.left_label = container.name;
            fields.title = this.name; }
        else {
            fields.right_url = '#' + add_query_param(this.url, "mode", "edit");
            fields.right_label = "Edit";
            fields.left_url = '#' + add_query_param(this.url, 'mode', "add");
            fields.left_label = "+";
            fields.title = "ShareRooms"; }
        this.layout_header_fields(fields); }

    RootShareNode.prototype.layout_header = function(mode_opts) {
        /* Fill in header fields of .my_page$(). */
        ShareNode.prototype.layout_header.call(this, mode_opts);
        var fields = {'right_url': '#' + add_query_param(this.url,
                                                         "mode", "edit"),
                      'right_label': "Edit"};
        this.layout_header_fields(fields); }

    ContentNode.prototype.layout_content = function (mode_opts) {
        /* Present this content node by adjusting its DOM data-role="page" */
        var $page = this.my_page$();
	var $content = $page.find('[data-role="content"]');
	var $list = this.my_contents_listview$();
        if ($list.children().length) {
            $list.empty(); }

        var lensubdirs = this.subdirs ? this.subdirs.length : 0;
        var lenfiles = this.files ? this.files.length : 0;
        var do_dividers = (lensubdirs + lenfiles) > defaults.dividers_threshold;
        var do_filter = (lensubdirs + lenfiles) > defaults.filter_threshold;

        function insert_item($item) {
            if ($cursor === $list) { $cursor.append($item); }
            else { $cursor.after($item); }
            $cursor = $item; }
        function conditionally_insert_divider(t) {
            if (do_dividers && t && (t[0].toUpperCase() !== curinitial)) {
                curinitial = t[0].toUpperCase();
                indicator = divider_prefix + curinitial;
                $item = $('<li data-role="list-divider" id="divider-'
                          + indicator + '">' + indicator + '</li>')
                insert_item($item); }}
        function insert_subnode(suburl) {
            var subnode = content_node_manager.get(suburl, this);
            conditionally_insert_divider(subnode.name);
            insert_item(subnode.layout_item$(mode_opts)); }

        if (lensubdirs + lenfiles === 0) {
            // XXX Need to convey that the container is empty more nicely.
            $list.append($('<li title="Empty" class="empty-sign"'
                           + 'class="empty-placeholder"/>')
                         .html('&nbsp;&nbsp;&nbsp;&nbsp;&empty;')); }
        else {
            var $item;
            var curinitial, divider_prefix, indicator = "";
            var $cursor = $list;

            if (do_filter) { $list.attr('data-filter', 'true'); }
            if (lensubdirs) {
                divider_prefix = "/";
                for (var i=0; i < this.subdirs.length; i++) {
                    insert_subnode(this.subdirs[i]); }}
            if (lenfiles) {
                divider_prefix = "";
                for (var i=0; i < this.files.length; i++) {
                    insert_subnode(this.files[i]); }}
        }
        $page.page();
        $list.listview("refresh");
        return $page; }

    FolderContentNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a folder-like content item's description as jQuery item. */
        var $href = $('<a/>').attr('class', "compact-vertical");
        $href.attr('href', "#" + this.url);
        $href.html($('<h4/>').html(this.name));
        var $it = $('<li/>').append($href);
        $it.attr('data-filtertext', this.name);
        return $it; }
    DeviceStorageNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a storage device's description as a jQuery item. */
        return FolderStorageNode.prototype.layout_item$.call(this); }
    FolderStorageNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a storage folder's description as a jQuery item. */
        return FolderContentNode.prototype.layout_item$.call(this, mode_opts); }
    FolderShareNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a share room folder's description as a jQuery item. */
        return FolderContentNode.prototype.layout_item$.call(this, mode_opts); }
    RoomShareNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a share room's description as a jQuery item. */
        return FolderShareNode.prototype.layout_item$.call(this,
                                                               mode_opts); }
    FileContentNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a file-like content node's description as a jQuery item. */
        var $it = $('<li data-mini="true"/>');
        $it.attr('data-filtertext', this.name);

        var type = classify_file_by_name(this.name);
        var pretty_type = type ? (type + ", ") : "";
        var $details = $('<p>' + pretty_type + bytesToSize(this.size) +'</p>');

        var date = new Date(this.mtime*1000);
        var day_splat = date.toLocaleDateString().split(",");
        var $date = $('<p class="ul-li-aside">'
                      + day_splat[1] + "," + day_splat[2]
                      + " " + date.toLocaleTimeString()
                      +'</p>');
        var $table = $('<table width="100%"/>');
        var $td = $('<td colspan="2"/>').append($('<h4/>').html(this.name));
        $table.append($('<tr/>').append($td));
        var $tr = $('<tr/>');
        $tr.append($('<td/>').append($details).attr('wrap', "none"));
        $tr.append($('<td/>').append($date).attr('align', "right"));
        $table.append($tr);
        var $href = $('<a/>');
        $href.attr('href', this.url);
        $href.attr('class', "compact-vertical");
        $href.append($table);
        $it.append($href);

        // XXX use classification to select an icon:
        $it.attr('data-icon', "false");

        return $it; }

    FileStorageNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a storage file's description as a jQuery item. */
        return FileContentNode.prototype.layout_item$.call(this, mode_opts); }
    FileShareNode.prototype.layout_item$ = function(mode_opts) {
        /* Return a storage file's description as a jQuery item. */
        return FileContentNode.prototype.layout_item$.call(this, mode_opts); }

    ContentNode.prototype.layout_footer = function(mode_opts) {
        /* Return markup with general and specific legend fields and urls. */
        // XXX Not yet implemented.
    }

    ContentNode.prototype.my_page_from_dom$ = function () {
        /* Return a jquery DOM search for my page, by id. */
        return $('#' + fragment_quote(this.my_page_id())); }
    ContentNode.prototype.my_page$ = function (reinit) {
        /* Return this node's jQuery page object, producing if not present.

           Optional 'reinit' means to discard existing page, if any,
           forcing clone of a new copy.

           If not present, we get a clone of the storage page template, and
           situate the clone after the storage page template.
        */
        if (reinit && this.$page) {
            this.$page.remove();
            delete this.$page; }
        if (! this.$page) {
            var $template = this.get_storage_page_template$();
            if (! $template) {
                error_alert("Missing markup",
                            "Expected page #"
                            + defaults.content_page_template_id
                            + " not present."); }
            this.$page = $template.clone();
            this.$page.attr('id', this.my_page_id());
            this.$page.attr('data-url', this.my_page_id());
            // Include our page in the DOM, after the storage page template:
            $template.after(this.my_page$()); }
        return this.$page; }
    RootContentNode.prototype.my_page$ = function () {
        /* Return the special case of the root content nodes actual page. */
        return (this.$page
                ? this.$page
                : (this.$page = $("#" + this.my_page_id()))); }

    ContentNode.prototype.my_contents_listview$ = function () {
        /* Return this node's jQuery contents litview object. */
        return this.my_page$().find('[data-role="listview"]'); }
    ContentNode.prototype.get_storage_page_template$ = function() {
        return $("#" + defaults.content_page_template_id); }


    /* ===== Resource managers ===== */

    var persistence_manager = {
        /* Maintain domain-specific persistent settings, using localStorage.
           - Value structure is maintained using JSON.
           - Use .get(name), .set(name, value), and .remove(name).
           - .keys() returns an array of all stored keys.
           - .length returns the number of keys.
         */
        // XXX Compat: versions of android < 2.1 do not support localStorage.
        //             They do support gears sqlite. lawnchair would make it
        //             easy to switch between them.
        get: function (name) {
            /* Retrieve the value for 'name' from persistent storage. */
            return JSON.parse(localStorage.getItem(name)); },
        set: function (name, value) {
            /* Preserve name and value in persistent storage.
               Return the settings manager, for chaining. */
            localStorage.setItem(name, JSON.stringify(value));
            return persistence_manager; },
        remove: function (name) {
            /* Delete persistent storage of name. */
            localStorage.removeItem(name); },
        keys: function () { return Object.keys(localStorage); },
        };
    // Gratuitous 'persistence_manager.length' getter, for a technical example:
    persistence_manager.__defineGetter__('length',
                                         function() {
                                             return localStorage.length; });
    var pmgr = persistence_manager;            // Compact name.


    var remember_manager = {
        /* Maintain user account info in persistent storage. */

        // "remember_me" field not in fields, so only it is retained when
        // remembering is disabled:
        fields: ['username', 'storage_host', 'storage_web_url'],

        active: function (disposition) {
            /* Report or set "Remember Me" persistent account info retention.
               'disposition':
                 - activate if truthy,
                 - return status if not passed in, ie undefined,
                 - deactivate otherwise.
               Deactivating entails wiping the retained account info settings.
            */
            if (disposition) {
                return persistence_manager.set("remember_me", true); }
            else if (typeof disposition === "undefined") {
                return persistence_manager.get("remember_me") || false; }
            else {
                fields.map(function (key) {
                    persistence_manager.remove(key); });
                return persistence_manager.set("remember_me", false); }},

        fetch: function () {
            /* Return remembered account info . */
            var got = {};
            remember_manager.fields.map(function (key) {
                got[key] = persistence_manager.get(key); });
            return got; },

        store: function (obj) {
            /* Preserve account info, obtaining specific fields from 'obj'.
               Error is thrown if obj lacks any fields. */
            remember_manager.fields.map(function (key) {
                if (! obj.hasOwnProperty(key)) {
                    throw new Error("Missing field: " + key); }
                persistence_manager.set(key, obj[key]); })},

        remove_storage_host: function () {
            /* How to inhibit auto-login, without losing the convenience of
               a remembered username, in the absence of a way to remove the
               authentication cookies. */
            persistence_manager.remove('storage_host'); },
    };
    var remgr = remember_manager;


    var content_node_manager = function () {
        /* A singleton utility for getting and removing content node objects.
           "Getting" means finding existing ones or else allocating new ones.
        */
        // Type of newly minted nodes are according to get parameters.

        // ???: Cleanup? Remove nodes when ascending above them?
        // ???:
        // - prefetch offspring layer and defer release til 2 layers above.
        // - make fetch of multiple items contingent to device lastcommit time.

        /* Private */
        var by_url = {};

        /* Public */
        return {
            get_combo_root: function () {
                return this.get(my.combo_root_url, null); },

            get: function (url, parent) {
                /* Retrieve a node according to 'url'.
                   'parent' is required for production of new nodes,
                   which are produced on first reference.
                   Provisioning nodes with remote data is done elsewhere,
                   not here.
                 */
                url = url.split('?')[0];             // Strip query string.
                var got = by_url[url];
                if (! got) {

                    // Roots:
                    if (is_content_root_url(url)) {
                        if (is_combo_root_url(url)) {
                            got = new RootContentNode(url, parent); }
                        else if (url === my.storage_root_url) {
                            got = new RootStorageNode(url, parent); }
                        else if (url === my.original_shares_root_url) {
                            got = new OriginalRootShareNode(url, parent); }
                        else if (url === my.actual_shares_root_url) {
                            got = new PublicRootShareNode(url, parent); }
                        else {
                            throw new Error("Content model management error");}}

                    // Contents:
                    else if (parent && (is_combo_root_url(parent.url))) {
                        // Content node just below a root:
                        if (is_storage_url(url)) {
                            got = new DeviceStorageNode(url, parent); }
                        else {
                            // XXX Distinguish between public and personal??
                            got = new RoomShareNode(url, parent); }}
                    else if (url.charAt(url.length-1) !== "/") {
                        // No trailing slash.
                        if (is_storage_url(url)) {
                            got = new FileStorageNode(url, parent); }
                        else {
                            got = new FileShareNode(url, parent); }}
                    else {
                        if (is_storage_url(url)) {
                            got = new FolderStorageNode(url, parent); }
                        else {
                            got = new FolderShareNode(url, parent); }
                    }
                    by_url[url] = got;
                }
                return got; },

            free: function (node) {
                /* Remove a content node from index and free it for gc. */
                if (by_url.hasOwnProperty(node.url)) {
                    delete by_url[node.url]; }
                node.free(); },

            clear_hierarchy: function (url) {
                /* Free node at 'url' and its recursively contained nodes. */
                var it = this.get(url);
                var suburls = it.contained_urls();
                for (var i=0; i < suburls.length; i++) {
                    this.clear_hierarchy(suburls[i]); }
                this.free(it); },

            // Expose the by_url registry when debugging:
            bu: (SO_DEBUGGING ? by_url : null),
        }
    }()
    var cnmgr = content_node_manager; // Compact name, for convenience.


    /* ===== Login ===== */

    function go_to_entrance() {
        /* Visit the entrance page. Depending on session state, it might
           present a login challenge or it might present the top-level
           contents associated with the logged-in account. */
        $.mobile.changePage(content_node_manager.get_combo_root().url); }

    function storage_login(login_info, url) {
        /* Login to storage account and commence browsing at devices.
           'login_info': An object with "username" and "password" attrs.
           'url': An optional url, else defaults.storage_login_path is used.
           We provide for redirection to specific alternative servers
           by recursive calls. See:
           https://spideroak.com/apis/partners/web_storage_api#Loggingin
        */
        var login_url;
        var server_host_url;
        var parsed;

        if (url
            && (parsed = $.mobile.path.parseUrl(url))
            && ["http:", "https:"].indexOf(parsed.protocol) !== -1) {
            server_host_url = parsed.domain;
            login_url = url; }

        else {
            server_host_url = defaults.base_host_url;
            login_url = (server_host_url + defaults.storage_login_path); }

        $.ajax({
            url: login_url,
            type: 'POST',
            dataType: 'text',
            data: login_info,
            success: function (data) {
                var match = data.match(/^(login|location):(.+)$/m);
                if (!match) {
                    error_alert('Temporary server failure',
                                'Please try again later.');
                } else if (match[1] === 'login') {
                    if (match[2].charAt(0) === "/") {
                        login_url = server_host_url + match[2];
                    } else {
                        login_url = match[2];
                    }
                    storage_login(login_info, login_url);
                } else {
                    // Browser haz auth cookies, we haz relative location.
                    // Go there, and machinery will intervene to handle it.
                    $.mobile.changePage(
                        set_storage_account(login_info['username'],
                                            server_host_url,
                                            match[2]));
                }},

            error: function (xhr) {
                $.mobile.hidePageLoadingMsg();
                error_alert("Storage login", xhr.status); },

        }); }

    function storage_logout() {
        /* Conclude storage login, clearing credentials and stored data.
           Wind up back on the main entry page.
         */
        function finish() {
            clear_storage_account();
            if (remember_manager.active()) {
                // The storage server doesn't remove cookies, so we inhibit
                // relogin by removing the persistent info about the
                // storage host. This leaves the username intact as a
                // "remember" convenience for the user.
                remember_manager.remove_storage_host(); }
            go_to_entrance(); }

        if (! content_node_manager.get_combo_root().loggedin_ish()) {
            // Can't reach logout location without server - just clear and bail.
            finish(); }
        else {
            // SpiderOak's logout url doesn't (as of 2012-06-15) remove cookies!
            $.ajax({url: my.storage_root_url + defaults.storage_logout_suffix,
                    type: 'GET',
                    success: function (data) {
                        finish(); },
                    error: function (xhr) {
                        console.log("Logout ajax fault: "
                                    + xhr.status
                                    + " (" + xhr.statusText + ")");
                        finish(); }}); }}

    function visit_public_share_room(credentials) {
        /* Visit a specified share room.
           'credentials': Object including "shareid" and "password" attrs.
        */
        $.mobile.changePage(
            add_public_share_room(credentials.shareid, credentials.password,
                                  defaults.share_host_url)); }

    RootContentNode.prototype.veil = function (conceal) {
        /* If 'conceal' is true, conceal our baudy body.  Otherwise, gradually
           reveal and position the cursor in the username field. */
        var selector = '#home [data-role="content"]';
        if (conceal) {
            $(selector).hide(0); }
        else {
            $(selector).fadeIn(2000, function () {
                $('#my_login_username').focus(); }); }}

    function prep_login_form(content_selector, submit_handler, name_field) {
        /* Instrument form within 'content_selector' to submit with
           'submit_handler'. 'name_field' is the id of the form field
           with the login name, "password" is assumed to be the
           password field id.

           The submit action fades the content and clears the password
           value, so it can't be reused.
        */
        var $content = $(content_selector);
        var $form = $(content_selector + " form");

        var $esm = $form.find(".error-status-message");
        $esm.hide();

        var $name = $('input[name=' + name_field + ']', this);
        var $remember_widget = $form.find('#remember-me');
        var remembering = remgr.active();
        if (remembering && ($remember_widget.val() !== "on")) {
            $remember_widget.find('option[value="on"]').attr('selected',
                                                             'selected');
            $remember_widget.val("on");
            // I believe the reason we need to also .change() is because
            // the presented slider is just tracking the actual select widget.
            $remember_widget.trigger('change'); }
        var name_field_val = pmgr.get(name_field);
        if (name_field_val
            && ($remember_widget.length > 0)
            && ($remember_widget.val() === "on")) {
            $name.attr('value',name_field_val); }

        $form.submit(function () {
            var $remember_widget = $form.find('#remember-me');
            var $name = $('input[name=' + name_field + ']', this);
            var $password = $('input[name=password]', this);
            var data = {};
            data[name_field] = $name.val();
            if ($remember_widget.length > 0) {
                // Preserve whether or not we're remembering, so on a
                // successful visits we'll know whether to preserve data:
                if ($remember_widget.val() === "on") {
                    remember_manager.active(true); }
                else {
                    remember_manager.active(false); }}

            data['password'] = $password.val();
            $content.fadeOut(1000, function() { $password.val("");});
            var unhide_form_oneshot = function(event, data) {
                $content.show('fast');
                $.mobile.hidePageLoadingMsg();
                $(document).unbind("pagechange", unhide_form_oneshot);
                $(document).unbind("error", unhide_form_oneshot); }
            $(document).bind("pagechange", unhide_form_oneshot)
            $(document).bind("error", unhide_form_oneshot)
            submit_handler(data);
            return false; }); }



    /* ===== Public interface ===== */

    // ("public_interface" because "public" is reserved in strict mode.)
    var public_interface = {
        init: function () {
            /* Do preliminary setup and launch into the combo root. */

            // Setup traversal hook:
            establish_traversal_handler();

            // Properly furnish login form:
            prep_login_form('.nav_login_storage', storage_login, 'username');

            my.combo_root_url = defaults.combo_root_url;
            var combo_root = content_node_manager.get_combo_root();

            // Hide everything below the banner, for subsequent unveiling:
            combo_root.veil(false);

            // Collect persistent settings
            if (remember_manager.active()) {
                var settings = remember_manager.fetch();
                if (settings.username && settings.storage_host) {
                    set_storage_account(settings.username,
                                        settings.storage_host,
                                        settings.storage_web_url); }}

            $.mobile.changePage(combo_root.url); },

    }


    /* ===== Convenience ===== */

    ContentNode.prototype.toString = function () {
        return "<" + this.emblem + ": " + this.url + ">"; }

    if (SO_DEBUGGING) {
        // Expose the managers for access while debugging:
        public_interface.cnmgr = cnmgr;
        public_interface.pmgr = pmgr; }


    /* ===== Here we go: ===== */
    return public_interface;
}();



$(document).ready(function () {
    "use strict";               // ECMAScript 5

    // Development convenience: Go back to start page on full document reload.
    // All the internal application state is gone, anyway.
    if (window.location.hash) {
        window.location.hash = "";
        $.mobile.changePage(window.location.href.split('#')[0]); }

    spideroak.init();
});
