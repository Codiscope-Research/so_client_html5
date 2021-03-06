/* Copyright 2012 SpiderOak, Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

function translate(text) {
    /* Stub translate function for eventual i8n. */
    return text
};
_t = translate;

function submit_button_sentinel(inputs, $submit) {
    /* Enable element if all inputs in 'inputs' array have content, else
       disable. */
    function submit_button_sentinel_closure() {
        var passed = true;
        inputs.map(function ($input) {
            if ($input.val() === "") {
                passed = false;
                $submit.button('disable'); }});
        if (passed) {
            $submit.button('enable'); }
        return true; }
    return submit_button_sentinel_closure; }

$(document).ready(function() {
    /* Nothing so far. */
})


function error_alert_message(purpose, status_code) {
    /* Return a error message for 'purpose' with 'status_code'.
       'purpose' should name the problem, and 'status_code' can be one
       of a few SpiderOak web status codes, or text elaborating the problem. */
    var msg;
    if (typeof status_code === "string") {
        msg = status_code; }
    else if (status_code === 401) {
        msg = 'Unauthorized.'; }
    else if (status_code === 403) {
        msg = 'Incorrect username or password.'; }
    else if (status_code === 404) {
        msg = 'Incorrect ShareID or RoomKey.'; }
    else {
        msg = ('Temporary server failure. Please try again later.'); }
    msg = translate(purpose) + ": " + translate(msg);
    if (typeof status_code !== "string") {
        msg += " (" + status_code + ")"; }
    return msg; }

function error_alert(purpose, status_code) {
    /* Post an alert and throw an error for 'purpose' with 'status_code'.
       'purpose' should name the problem, and 'status_code' can be one
       of a few SpiderOak web status codes, or text elaborating the problem. */
    var msg = error_alert_message(purpose, status_code);
    $(document).trigger("error");
    alert(msg);
    throw new Error(msg);
}

function fragment_quote(id) {
    /* Escape fragment selector chars to avoid jQuery mistaking for CSS
       selector *or other* non-fragment constructs. */
    // The '/' does need to be quoted, surprisingly.
    return id.replace(/(:|\.|\/)/g,'\\$1'); }

function blather(msg, do_alert) {
    if (SO_DEBUGGING) {
        if (do_alert) { alert(msg); }
        else { console.log(msg); }
    }
}

// This uses is for application to the tables below, and is used by the
// functions immediately below them.
function lookup_file_by_name(name, table) {
    /* Retrieve the result of seeking 'name's suffix in 'table', doing some
       finagling to get the proper suffix. */
    var splat = name.split('.');
    var extension = splat[splat.length-1];
    var is_backup = false;
    var got = table[extension.toLowerCase()];
    if (! got) {
        if (splat.length > 2 && (extension.match(/[0-9]/)
                                 || extension.match("~")
                                 || extension.match("#"))) {
            is_backup = true;
            var extension = splat[splat.length-2];
            got = table[extension];
        }}
    return got || ""; }

var FILE_CLASS_TO_SUFFIX_AND_ICON = {
    /* Map classifications to [0] a list of suffixes and [1] an icon name.
       Change this to adjust the more targeted, derived tables. */
    text: [['txt'],
           'text'],
    acrobat: [['pdf'],
              'text'],
    ebook: [['mobi', 'epub', 'azw'], 'ebook'],
    doc: [['doc', 'docx'],
          'doc'],
    picture: [['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'ps', 'eps'],
              'picture'],
    video: [['mov', 'mpg', 'mpeg', 'avi', 'wmv'],
            'video'],
    audio: [['mp3', 'm4a', 'm4p', 'ogg', 'flac', 'aiff',
             'au', 'pcm', 'wav', 'aac', 'wma'],
            'audio'],
    exe: [['exe', 'o'],
          'file'],
    code: [['c', 'sh', 'py', 'pl', 'tcl', 'bat',
            'js', 'css', 'html', 'htm', 'xml', 'php'],
           'file'],
    archive: [['zip', 'jar', 'tgz', 'tjz', 'tar'],
              'file'],
}
var FILE_SUFFIX_TO_CLASS = {};
var FILE_SUFFIX_TO_ICON = {};

function derive(class_to_suffix_and_icon, suffix_to_class, suffix_to_icon) {
    /* From 'class_to_suffix_and_icon', derive the contents of
       'suffix_to_class' and 'suffix_to_icon'. */

    var fctsai_keys = Object.keys(class_to_suffix_and_icon);
    for (var i=0; i < fctsai_keys.length; i++) {
        var file_class = fctsai_keys[i];
        var entry = class_to_suffix_and_icon[file_class];
        var suffixes = entry[0];
        var icon = entry[1];
        suffixes.map(function (suffix) {
            suffix_to_class[suffix] = file_class;
            suffix_to_icon[suffix] = icon; }); }}

derive(FILE_CLASS_TO_SUFFIX_AND_ICON,
       FILE_SUFFIX_TO_CLASS, FILE_SUFFIX_TO_ICON);

var FILE_SUFFIX_TO_DESCRIPTION = {txt: "Text",
                                  pdf: "Adobe PDF",
                                  doc: "MS Word", docx: "MS Word (Open XML)",
                                  xls: "MS Excel",
                                  ppt: "MS Powerpoint",
                                  png: "Image", jpg: "Image", jpeg: "Image",
                                  gif: "Image",
                                  ico: "MS Icon",
                                  svg: "Structured Vector Graphics",
                                  ps: "PostScript", eps: "Extended PostScript",
                                  avi: "Video", mpg: "Video", mpeg: "Video",
                                  mov: "Video",
                                  wmv: "Windows Media Video",
                                  mp3: "MPEG Audio", ogg: "Ogg Vorbis Audio",
                                  wav: "Waveform Audio",
                                  wma: "Windows Media Audio",
                                  exe: "Executable",
                                  o: "Linkable Object Code",
                                  c: "C Source Code",
                                  sh: "Shell Script",
                                  py: "Python Script",
                                  pl: "Perl Script",
                                  tcl: "TCL Script",
                                  js: "Javascript",
                                  bat: "MS Batch Script",
                                  zip: "Compressed Archive (zip)",
                                  gz: "Compressed (gzip)",
                                  tgz: "Compressed Archive (gzip)",
                                  jar: "Java Archive",
                                  htm: "HyperText", html: "HyperText",
                                  php: "PHP HyperText",
                                  xml: "Extensible Markup Language",
                                  db: "Database",
                                  dat: "Data",
                                 }

function describe_file_by_name(name) {
    /* Return a brief description of file type according to file 'name' suffix.
       Return empty string if we fail to infer anything. */
    return lookup_file_by_name(name, FILE_SUFFIX_TO_DESCRIPTION); }
function classify_file_by_name(name) {
    /* Return a string inferred from a file's name.
       Return empty string if we fail to infer anything. */
    return lookup_file_by_name(name, FILE_SUFFIX_TO_CLASS); }
function icon_name_by_file_name(name) {
    return lookup_file_by_name(name, FILE_SUFFIX_TO_ICON); }

function bytesToSize(bytes) {
    /* Return description of number of 'bytes' */
    /* Adapted from an entry found on:
       http://codeaid.net/javascript/convert-size-in-bytes-to-human-readable-format-(javascript) */
    if (! bytes) { return "empty"; }
    var sizes = [ 'n/a', 'bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    var i = +Math.floor(Math.log(bytes) / Math.log(1024));
    return  ((bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)
             + ' ' + sizes[isNaN(bytes) ? 0 : i+1]);
}

function add_query_param(url, parameter, value, dither) {
    /* Include on 'url' query 'parameter' with 'value'.
       Optional 'dither', if true, adds 'dither=<9-digit random integer>' to
       the query string, for a URL very likely to be distinct.
     */
    var parsed = $.mobile.path.parseUrl(url);
    var got = url + (parsed.search ? "&" : "?") + parameter + "=" + value;
    if (dither) { got += '&dither=' + Math.floor(Math.random() * 1e9); }
    return got;
}
function query_params(url) {
    /* Return an object with settings indicated by 'url' search parameters. */
    var search = $.mobile.path.parseUrl(url).search;
    var got = {};
    if (search) {
        search.slice(1,search.length).split('&').map(
            function (combo) {
                var pair = combo.split('='); got[pair[0]] = pair[1]; })};
    return got;
}

function replace_button_text($slot, label_text) {
    /* Set a button contained in jquery '$slot' element to have 'label_text'.
       We look for .ui-btn-txt within the slot, else replace the slot's html.
     */
    var $into = $slot.find('.ui-btn-text');
    if (! $into.length) { $into = $slot; }
    $into.html(label_text); }

function elide(text, limit) {
    /* Return 'text', with any characters beyond 'limit' elided with "..."
       elipsis. */
    if (text.length <= limit) { return text; }
    else { return text.slice(0, limit) + ".."; }}

function toastish(message, duration, theme) {
    /* Show android-ish toast 'message', timed-out after 'duration' millesecs.
       Optional 'theme' specifies a theme swatch to use, default "b". */
    $.mobile.hidePageLoadingMsg();
    setTimeout(function () {
        $.mobile.showPageLoadingMsg(theme || "b", message, true); }, 0);
    setTimeout(function () { $.mobile.hidePageLoadingMsg(); }, duration); }

function bind_replace(object, binding, the_func) {
    /* On 'object', add 'binding' to 'function'.  Replace existing binding
       if present. */
    object.unbind(binding, the_func);
    object.bind(binding, the_func); }

function deploy_focus_oneshot(selector, event) {
    /* Deploy a reliable 'selector' input-field focus function on 'event'.
       Use to avoid page-loading timing complications, eg using jQm pageshow.
       The function removes itself after firing. */
    var focus_oneshot = function(e, data) {
        $(selector).focus();
        $(document).unbind(event, focus_oneshot); }
    bind_replace($(document), event, focus_oneshot); }

/** Return a url's trailing non-divider string.
 *
 * That is, the non-empty portion of the url after the final
 * '/' and '#'.  Hence, that part needs to be distinct to
 * distinguish among provided urls.
 *
 * @param {string} url Web address from which the tail is derived.
 */
function url_tail(url) {
    if (! url) {
        return "undefined"; }
    // Remove trailing '#' or '/', if any:
    url = url.replace(/[#/]$/, "");
    // Get string that trails all remaining '/' and '#':
    return url.split(/[#/]/).slice(-1)[0];
}

/** Best guess whether we're operating within Cordova/PhoneGap.
 *
 * False positives are possible, but there should be no false negatives.
 */
function in_cordova() {
    return ((typeof window.device !== "undefined")
            && (typeof window.device.cordova !== "undefined"));
}

/** Keychain object, for reuse via get_keychain.
 */
var keychain = null;

/** Return the keychain, if available, else return undefined.
 *
 * If unavailable and dummy keychain alert is not inihibited, post an alert
 * about using an insecure dummy substitute.
 */
function get_keychain() {
    if (keychain) {
        return keychain;
    } else if (in_cordova()) {
        return keychain = cordova.require("cordova/plugin/keychain");
    } else if (SO_DEBUGGING) {
        var msg = "Using INSECURE keychain stub - localStorage";
        toastish(msg, 10000);
        blather(msg);
        return keychain = new keychain_stub();
    } else {
        throw new Error("No secure storage/keychain.");
    }
}

function keychain_stub() {};
keychain_stub.prototype.getForKey = function (done_callback, fail_callback,
                                              name, servicename) {
        done_callback(localStorage.getItem(name));
        return true; }
keychain_stub.prototype.setForKey = function (done_callback, fail_callback,
                                              name, value, servicename) {
    done_callback(localStorage.setItem(name, value));
    return true; }
keychain_stub.prototype.removeForKey = function (done_callback, fail_callback,
                                                 name, servicename) {
    done_callback(localStorage.removeItem(name));
    return true; }

// Polyfill for context .bind(context), for it's lack in Safari.
// Taken almost verbatim from
// developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind"
                          + " - what is trying to be bound is not callable"); }

    var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP
                               ? this
                               : oThis,
                               aArgs.concat(
                                   Array.prototype.slice.call(arguments))); };
      fNOP.prototype = this.prototype;
      fBound.prototype = new fNOP();
      return fBound;
  };
}
