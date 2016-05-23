var gQuicktext = Components.classes["@hesslow.se/quicktext/main;1"].getService(Components.interfaces.wzIQuicktext);
var gQuicktextVar = Components.classes["@hesslow.se/quicktext/variables;1"].createInstance(Components.interfaces.wzIQuicktextVar);
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var quicktextStateListener = {
  NotifyComposeBodyReady: function()
  {
  	quicktext.insertDefaultTemplate();
  },

  NotifyComposeFieldsReady: function() {},
  ComposeProcessDone: function(aResult) {},
  SaveInFolderDone: function(folderURI) {}
}

var quicktext = {
  mStringBundle:                null,
  mLoaded:                      false,
  mSelectionContent:            null,
  mLastFocusedElement:          null,
  mShortcuts:                   {},
  mShortcutString:              "",
  mShortcutModifierDown:        false,
  mKeywords:                    {}
,
  load: function()
  {
    if (!this.mLoaded)
    {
      this.mLoaded = true;

      this.mStringBundle = document.getElementById("quicktextStringBundle");

      gQuicktext.addObserver(this);
      if (!gQuicktext.loadSettings(false))
        this.updateGUI();

      gQuicktextVar.init(window);

      // Add an eventlistener for keypress in the window
      window.addEventListener("keypress", function(e) { quicktext.windowKeyPress(e); }, true);
      window.addEventListener("keydown", function(e) { quicktext.windowKeyDown(e); }, true);
      window.addEventListener("keyup", function(e) { quicktext.windowKeyUp(e); }, true);

      // Add an eventlistener for keypress in the editor
      var contentFrame = GetCurrentEditorElement();
      contentFrame.addEventListener("keypress", function(e) { quicktext.editorKeyPress(e); }, false);

    	// Add an eventlistener for the popup-menu.
    	var menu = document.getElementById("msgComposeContext");
	    menu.addEventListener("popupshowing", function(e) { quicktext.popupshowing(e); }, false);

      // Need to update GUI when the Quicktext-button is added to the toolbar.
      var composeToolbar = (document.getElementById("composeToolbar")) ? document.getElementById("composeToolbar") : document.getElementById("composeToolbar2");
      if (composeToolbar)
        composeToolbar.addEventListener("DOMNodeInserted", function(e) { quicktext.toolbarButtonAdded(e); }, false);
    }
  }
,
  reload: function()
  {
    gQuicktextVar.init(window);
  }
,
  unload: function()
  {
    // Remove the observer
    gQuicktext.removeObserver(this);

    window.removeEventListener("keypress", function(e) { quicktext.windowKeyPress(e); }, false);
    window.removeEventListener("keydown", function(e) { quicktext.windowKeyDown(e); }, false);
    window.removeEventListener("keyup", function(e) { quicktext.windowKeyUp(e); }, false);

    // Remove the eventlistener from the editor
    var contentFrame = GetCurrentEditorElement();
    contentFrame.removeEventListener("keypress", function(e) { quicktext.editorKeyPress(e); }, false);

  	// Remove the eventlistener for the popup-menu.
  	var menu = document.getElementById("msgComposeContext");
    menu.removeEventListener("popupshowing", function(e) { quicktext.popupshowing(e); }, false);

    // Need to update GUI when the Quicktext-button is added to the toolbar.
    var composeToolbar = (document.getElementById("composeToolbar")) ? document.getElementById("composeToolbar") : document.getElementById("composeToolbar2");
    if (composeToolbar)
      composeToolbar.removeEventListener("DOMNodeInserted", function(e) { quicktext.toolbarButtonAdded(e); }, false);
  }
,

	/**
	 * This is called when the var gMsgCompose is init. We now take
	 * the extraArguments value and listen for state changes so
	 * we know when the editor is finished.
	 */
  windowInit: function()
  {
  	gMsgCompose.RegisterStateListener(quicktextStateListener);
  }
,
  /*
   * This is called when the body of the mail is set up.
   * So now it is time to insert the default template if
   * there exists one.
   */
	insertDefaultTemplate: function()
	{
	  dump("insertDefaultTemplate\n");
	}
,
  updateGUI: function()
  {
    // Set the date/time in the variablemenu
    var dateTimeService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"].getService(Components.interfaces.nsIScriptableDateFormat);
    var timeStamp = new Date();

    if (document.getElementById("date-short"))
      document.getElementById("date-short").setAttribute("label", this.mStringBundle.getFormattedString("date", [dateTimeService.FormatDate("", dateTimeService.dateFormatShort, timeStamp.getFullYear(), timeStamp.getMonth()+1, timeStamp.getDate())]));
    if (document.getElementById("date-long"))
      document.getElementById("date-long").setAttribute("label", this.mStringBundle.getFormattedString("date", [dateTimeService.FormatDate("", dateTimeService.dateFormatLong, timeStamp.getFullYear(), timeStamp.getMonth()+1, timeStamp.getDate())]));
    if (document.getElementById("time-noseconds"))
      document.getElementById("time-noseconds").setAttribute("label", this.mStringBundle.getFormattedString("time", [dateTimeService.FormatTime("", dateTimeService.timeFormatNoSeconds, timeStamp.getHours(), timeStamp.getMinutes(), timeStamp.getSeconds())]));
    if (document.getElementById("time-seconds"))
      document.getElementById("time-seconds").setAttribute("label", this.mStringBundle.getFormattedString("time", [dateTimeService.FormatTime("", dateTimeService.timeFormatSeconds, timeStamp.getHours(), timeStamp.getMinutes(), timeStamp.getSeconds())]));

    // Empty all shortcuts and keywords
    this.mShortcuts = {};
    this.mKeywords = {}

    // Update the toolbar
    if ((toolbar = document.getElementById("quicktext-toolbar")) != null)
    {
      var toolbarbuttonVar = null;
      var toolbarbuttonOther = null;

      var length = toolbar.childNodes.length;
      for(var i = length-1; i >= 0; i--)
      {
        toolbarbutton = toolbar.childNodes[i];
        switch(toolbarbutton.getAttribute("id"))
        {
          case 'quicktext-variables':
            toolbarbuttonVar = toolbarbutton.cloneNode(true);
            break;
          case 'quicktext-other':
            toolbarbuttonOther = toolbarbutton.cloneNode(true);
            break;
        }
        toolbar.removeChild(toolbarbutton);
      }

      var groupLength = gQuicktext.getGroupLength(false);
      for (var i = 0; i < groupLength; i++)
      {
        var textLength = gQuicktext.getTextLength(i, false);
        if (textLength)
        {
          var toolbarbuttonGroup = toolbar.appendChild(document.createElement("toolbarbutton"));

          if (textLength == 1 && gQuicktext.collapseGroup)
          {
            toolbarbuttonGroup.setAttribute("oncommand", "quicktext.insertTemplate(\"" + i + "\",\"0\");");
            toolbarbuttonGroup.setAttribute("label", gQuicktext.getText(i, 0, false).name);
          }
          else
          {
            toolbarbuttonGroup.setAttribute("type", "menu");
            toolbarbuttonGroup.setAttribute("label", gQuicktext.getGroup(i, false).name);
            var menupopup = toolbarbuttonGroup.appendChild(document.createElement("menupopup"));

            for (var j = 0; j < textLength; j++)
            {
              var text = gQuicktext.getText(i, j, false);

              var toolbarbutton = document.createElement("menuitem");
              toolbarbutton.setAttribute("oncommand", "quicktext.insertTemplate(\"" + i + "\",\"" + j + "\");");   // event.target.value
              toolbarbutton.setAttribute("label", text.name);

              var shortcut = text.shortcut;
              if (shortcut > 0)
              {
                if (shortcut == 10) shortcut = 0;
                toolbarbutton.setAttribute("acceltext", "Alt+" + shortcut);
              }

              menupopup.appendChild(toolbarbutton);
            }
          }

          // Update the keyshortcuts
          for (var j = 0; j < textLength; j++)
          {
            var text = gQuicktext.getText(i, j, false);
            var shortcut = text.shortcut;
            if (shortcut != "" && typeof this.mShortcuts[shortcut] == "undefined")
              this.mShortcuts[shortcut] = [i, j];

            var keyword = text.keyword;
            if (keyword != "" && typeof this.mKeywords[keyword.toLowerCase()] == "undefined")
              this.mKeywords[keyword.toLowerCase()] = [i, j];
          }
        }
      }

      var spacer = document.createElement("spacer");
      spacer.setAttribute("flex", "1");
      toolbar.appendChild(spacer);
      toolbar.appendChild(toolbarbuttonVar);
      toolbar.appendChild(toolbarbuttonOther);

      // Update the main toolbar
      if (document.getElementById("button-quicktext") != null && (mainToolbar = document.getElementById("button-quicktext").childNodes[0]) != null)
      {
        var length = mainToolbar.childNodes.length;
        for(var i = length-1; i >= 0; i--)
          mainToolbar.removeChild(mainToolbar.childNodes[i]);

        for (var i = 0; i < toolbar.childNodes.length; i++)
        {
          var node = toolbar.childNodes[i];
          switch (node.nodeName)
          {
            case "toolbarbutton":
              // Check if the group is collapse or not
              var menu;
              if (node.getAttribute("type") == "menu")
              {
                menu = document.createElement("menu");
                menu.setAttribute("label", node.getAttribute("label"));
  
                for (var j = 0; j < node.childNodes.length; j++)
                  menu.appendChild(node.childNodes[j].cloneNode(true));
              }
              else
              {
                menu = document.createElement("menuitem");
                menu.setAttribute("label", node.getAttribute("label"));
                menu.setAttribute("oncommand", node.getAttribute("oncommand"));
              }
              mainToolbar.appendChild(menu);
              break;
            case "spacer":
              mainToolbar.appendChild(document.createElement("menuseparator"));
              break;
          }
        }
      }

      // Update the popupmenu
      if (document.getElementById("quicktext-popup") != null && (popup = document.getElementById("quicktext-popup").childNodes[0]) != null)
      {
        var length = popup.childNodes.length;
        for(var i = length-1; i >= 0; i--)
          popup.removeChild(popup.childNodes[i]);

        for (var i = 0; i < toolbar.childNodes.length; i++)
        {
          var node = toolbar.childNodes[i];
          switch (node.nodeName)
          {
            case "toolbarbutton":
              var menu;
              if (node.getAttribute("type") == "menu")
              {
                menu = document.createElement("menu");
                menu.setAttribute("label", node.getAttribute("label"));
  
                for (var j = 0; j < node.childNodes.length; j++)
                  menu.appendChild(node.childNodes[j].cloneNode(true));
              }
              else
              {
                menu = document.createElement("menuitem");
                menu.setAttribute("label", node.getAttribute("label"));
                menu.setAttribute("oncommand", node.getAttribute("oncommand"));
              }
              popup.appendChild(menu);
              break;
            case "spacer":
              popup.appendChild(document.createElement("menuseparator"));
              break;
          }
        }
      }

      // This is for personalscripts  
      // this.updateOwnVariables("quicktext.insertVariable");
    }

    this.visibleToolbar();
  }
,
  popupshowing: function(aEvent)
  {
    var hidden = !gQuicktext.viewPopup;
    document.getElementById("quicktext-popup").hidden = hidden;
    document.getElementById("quicktext-popupsep").hidden = hidden;
  }
,
  toolbarButtonAdded: function(aEvent)
  {
    if (aEvent.originalTarget && aEvent.originalTarget.getAttribute("id") == "button-quicktext")
      this.updateGUI();
  }
,
  openSettings: function()
  {
    var settingsHandle = window.open("chrome://quicktext/content/settings.xul", "quicktextConfig", "chrome,resizable,centerscreen");
    settingsHandle.focus();
  }
,
  toogleToolbar: function()
  {
    gQuicktext.viewToolbar = !gQuicktext.viewToolbar;
  }
,
  visibleToolbar: function()
  {
    // Set the view of the toolbar to what it should be
    if (gQuicktext.viewToolbar)
    {
      document.getElementById("quicktext-view").setAttribute("checked", true);
      document.getElementById("quicktext-toolbar").removeAttribute("collapsed");
    }
    else
    {
      document.getElementById("quicktext-view").removeAttribute("checked");
      document.getElementById("quicktext-toolbar").setAttribute("collapsed", true);
    }    
  }
,

  /*
   * INSERTING TEXT
   */
  insertVariable: function(aVar)
  {
    this.insertBody("[["+ aVar +"]] ", 0, true);
  }
,
  insertTemplate: function(aGroupIndex, aTextIndex, aHandleTransaction)
  {
    if (typeof aHandleTransaction == "undefined")
      aHandleTransaction = true;

    if (gQuicktext.doTextExists(aGroupIndex, aTextIndex, false))
    {
      this.mLastFocusedElement = (document.commandDispatcher.focusedWindow != window) ? document.commandDispatcher.focusedWindow : document.commandDispatcher.focusedElement;

      var text = gQuicktext.getText(aGroupIndex, aTextIndex, false);
      this.insertSubject(text.subject);
      this.insertBody(text.text, text.type, aHandleTransaction);
    }
  }
,
  insertSubject: function(aStr)
  {
    if (aStr != "")
    {
      aStr = gQuicktextVar.parse(aStr);

      if (aStr != "" && !aStr.match(/^\s+$/) && document.getElementById('msgSubject'))
        document.getElementById('msgSubject').value = aStr;
    }
  }
,
  insertBody: function(aStr, aType, aHandleTransaction)
  {
    if (aStr != "")
    {
      aStr = gQuicktextVar.parse(aStr);

      if (aStr != "")
      {
        // Inserts the text
        if (aStr != "" && !aStr.match(/^\s+$/))
        {
          var editor = GetCurrentEditor();
          if (aHandleTransaction)
            editor.beginTransaction();
  
          if (editor.selection.rangeCount > 0)
          {
            var startRange = editor.selection.getRangeAt(0).cloneRange();
            var specialRange = [startRange.startContainer.parentNode, this.getChildNodeIndex(startRange.startContainer.parentNode, startRange.startContainer), startRange.startOffset];
          }

          try {
            if (gMsgCompose.composeHTML && aType > 0)
            {
              // It the text is inserted as HTML we need to remove bad stuff
              // before we insert it.

              aStr = gQuicktextVar.removeBadHTML(aStr);

              editor.insertHTML(aStr);
            }
            else
              editor.insertText(aStr);
          }
          catch(e) {}
  
          if (editor.selection.rangeCount > 0)
            var endRange = editor.selection.getRangeAt(0).cloneRange();
  
          try {
            if (specialRange && endRange)
            {
              var newRange = editor.document.createRange();
              newRange.setStart(specialRange[0].childNodes[specialRange[1]], specialRange[2]);
              newRange.setEnd(endRange.endContainer, endRange.endOffset);
  
              // Take care of the CURSOR-tag
              this.parseCursorTag(editor, newRange);
            }
          }
          catch(e) {}
  
          if (aHandleTransaction)
            editor.endTransaction();
        }
      }
    }
  }
,
  parseCursorTag: function(aEditor, aSearchRange)
  {
    var startRange = aEditor.document.createRange();
    startRange.setStart(aSearchRange.startContainer, aSearchRange.startOffset);
    startRange.setEnd(aSearchRange.startContainer, aSearchRange.startOffset);
    var endRange = aEditor.document.createRange();
    endRange.setStart(aSearchRange.endContainer, aSearchRange.endOffset);
    endRange.setEnd(aSearchRange.endContainer, aSearchRange.endOffset);

    var finder = Components.classes["@mozilla.org/embedcomp/rangefind;1"].createInstance().QueryInterface(Components.interfaces.nsIFind);
    finder.caseSensitive = true;
    finder.findBackwards = false;

    var found = false;
    while ((foundRange = finder.Find("[[CURSOR]]", aSearchRange, startRange, endRange)) != null)
    {
      found = true;
      aEditor.selection.removeAllRanges();
      aEditor.selection.addRange(foundRange);
      aEditor.selection.deleteFromDocument();
      startRange.setEnd(foundRange.endContainer, foundRange.endOffset);
      startRange.setStart(foundRange.endContainer, foundRange.endOffset);
    }

    if (!found)
    {
      aEditor.selection.removeAllRanges();
      aEditor.selection.addRange(endRange);
    }
  }
,
  dumpTree: function(aNode, aLevel)
  {
    for (var i = 0; i < aLevel*2; i++)
      dump(" ");
    dump(aNode.nodeName +": "+ aNode.nodeValue +"\n");
    for (var i = 0; i < aNode.childNodes.length; i++)
    {
      this.dumpTree(aNode.childNodes[i], aLevel+1);
    }
  }
,
  getChildNodeIndex: function(aParentNode, aChildNode)
  {
    for(var i = 0; i < aParentNode.childNodes.length; i++)
    {
      if (aParentNode.childNodes[i] == aChildNode)
        return i;
    }

    return null;
  }
,
  insertContentFromFile: function(aType)
  {
    if ((file = gQuicktext.pickFile(window, aType, 0, this.mStringBundle.getString("insertFile"))) != null)
      this.insertBody(gQuicktext.readFile(file), aType, true);
  }
,

  /*
   * KEYPRESS
   */
  windowKeyPress: function(e)
  {
    if (gQuicktext.shortcutTypeAdv)
    {
      var shortcut = e.charCode-48;
      if (shortcut >= 0 && shortcut < 10 && this.mShortcutModifierDown)
      {
        this.mShortcutString += String.fromCharCode(e.charCode);

        e.preventBubble();
        e.preventDefault();
      }
    }
    else
    {
      var modifier = gQuicktext.shortcutModifier;
      var shortcut = e.charCode-48;
      if (shortcut >= 0 && shortcut < 10 && typeof this.mShortcuts[shortcut] != "undefined" && (
          e.altKey && modifier == "alt" ||
          e.ctrlKey && modifier == "control" ||
          e.metaKey && modifier == "meta"))
      {
        this.insertTemplate(this.mShortcuts[shortcut][0], this.mShortcuts[shortcut][1]);

        e.preventBubble();
        e.preventDefault();
      }
    }
  }
,
  windowKeyDown: function(e)
  {
    var modifier = gQuicktext.shortcutModifier;
    if (!this.mShortcutModifierDown && gQuicktext.shortcutTypeAdv && (
        e.keyCode == e.DOM_VK_ALT && modifier == "alt" ||
        e.keyCode == e.DOM_VK_CONTROL && modifier == "control" ||
        e.keyCode == e.DOM_VK_META && modifier == "meta"))
      this.mShortcutModifierDown = true;
  }
,
  windowKeyUp: function(e)
  {
    var modifier = gQuicktext.shortcutModifier;
    if (gQuicktext.shortcutTypeAdv && (
        e.keyCode == e.DOM_VK_ALT && modifier == "alt" ||
        e.keyCode == e.DOM_VK_CONTROL && modifier == "control" ||
        e.keyCode == e.DOM_VK_META && modifier == "meta"))
    {
      if (this.mShortcutString != "" && typeof this.mShortcuts[this.mShortcutString] != "undefined")
      {
        this.insertTemplate(this.mShortcuts[this.mShortcutString][0], this.mShortcuts[this.mShortcutString][1]);

        e.preventBubble();
        e.preventDefault();
      }

      this.mShortcutModifierDown = false;
      this.mShortcutString = "";
    }
  }
,
  editorKeyPress: function(e)
  {
    var key = (e.keyCode > 0) ? e.keyCode : e.charCode;

    if (key == gQuicktext.keywordKey)
    {
      var editor = GetCurrentEditor();
      var selection = editor.selection;

      if (!(selection.rangeCount > 0))
        return;

      editor.beginTransaction();
      var selecRange = selection.getRangeAt(0).cloneRange();


      // Ugly solution to just search to the beginning of the line.
      // I set the selection to the beginning of the line save the
      // range and then sets the selection back to was before.
      // Changing the selections was not visible to me. Most likly is
      // that is not even rendered

      var tmpRange = selecRange.cloneRange();
      tmpRange.collapse(false);
      editor.selection.removeAllRanges();
      editor.selection.addRange(tmpRange);

      editor.selectionController.intraLineMove(false, true);
      if (!(selection.rangeCount > 0))
      {
        editor.endTransaction();
        return;
      }

      var wholeRange = selection.getRangeAt(0).cloneRange();
      editor.selection.removeAllRanges();
      editor.selection.addRange(selecRange);

      var startRange = editor.document.createRange();
      startRange.setStart(wholeRange.endContainer, wholeRange.endOffset);
      startRange.setEnd(wholeRange.endContainer, wholeRange.endOffset);
      var endRange = editor.document.createRange();
      endRange.setStart(wholeRange.startContainer, wholeRange.startOffset);
      endRange.setEnd(wholeRange.startContainer, wholeRange.startOffset);

      var lastwordRange = editor.document.createRange();
      var found = false;
      var str = wholeRange.toString();
      if (str == "")
      {
        editor.endTransaction();
        return;
      }

      var foundRange;
      var finder = Components.classes["@mozilla.org/embedcomp/rangefind;1"].createInstance().QueryInterface(Components.interfaces.nsIFind);
      finder.findBackwards = true;
      if ((foundRange = finder.Find(" ", wholeRange, startRange, endRange)) != null)
      {
        found = true;
        if (foundRange.endContainer == selecRange.startContainer && foundRange.endOffset == selecRange.startOffset)
        {
          editor.endTransaction();
          return;
        }

        lastwordRange.setStart(foundRange.endContainer, foundRange.endOffset);
        lastwordRange.setEnd(selecRange.endContainer, selecRange.endOffset);
      }
      else
      {
        lastwordRange.setStart(wholeRange.startContainer, wholeRange.startOffset);
        lastwordRange.setEnd(selecRange.endContainer, selecRange.endOffset);
      }

      var lastword = lastwordRange.toString();
      var groupLength = gQuicktext.getGroupLength(false);

      var found = false;
      if (this.mKeywords.hasOwnProperty(lastword.toLowerCase()))
      {
        editor.selection.removeAllRanges();
        editor.selection.addRange(lastwordRange);

        var text = this.mKeywords[lastword.toLowerCase()];
        this.insertTemplate(text[0], text[1], false);

        found = true;
      }

      editor.endTransaction();
      if (found)
      {
        e.preventBubble();
        e.preventDefault();
      }
    }
  },

  /*
   * OBSERVERS
   */
  observe: function(aSubject, aTopic, aData)
  {
    switch(aTopic)
    {
      case "updatesettings":
        this.updateGUI();
        break;
      case "updatetoolbar":
        this.visibleToolbar();
        break;
    }
  }
,
  createInstance: function(aOuter, aIID)
  {
    if (aOuter != null) throw Components.results.NS_ERROR_NO_AGGREGATION;
    return policy;
  }
,
  QueryInterface: XPCOMUtils.generateQI([
    Components.interfaces.nsIObserver,
    Components.interfaces.nsISupportsWeakReference,
    Components.interfaces.nsIFactory,
    ])
}

// Make Array.indexOf work in Firefox versions older than 1.1
if  (!Array.prototype.indexOf)
{
  Array.prototype.indexOf = function(item)
  {
    for (var i = 0; i < this.length; i++)
        if (this[i] == item)
            return i;
    return -1;
  };
}