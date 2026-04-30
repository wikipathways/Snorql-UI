
(function ($) {

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for non-secure contexts (HTTP deployments)
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
}

jQuery(document).ready(function() {

        jQuery("#query-button").on("click",function(event){
            event.preventDefault();

            var query = editor.getDoc().getValue();

            var queryEncoded = "?q="+encodeURIComponent(query)+"&endpoint="+encodeURIComponent(jQuery("#endpoint").val().trim());
            var url = window.location.href.split('?')[0] + queryEncoded;

            window.history.replaceState(null, "", url);

            doQuery(jQuery("#endpoint").val(), query, function(json) { displayResult(json, "SPARQL results"); });

		});

		jQuery("#fetch").on("click",function(){
            fetchExamples();
            fetchExamples("-fs");
		});

        //---------------- Populate query from URL (if available) -----------------------

        var query = findGetParameter("q");
        if(query != null){
            editor.getDoc().setValue(query);
        }

        //----------------  END OF Populate query from URL (if available) -----------------------

		//---------------- Search funcionality starts ------------------------

        var search = function(e) {
          var pattern = $('#input-search').val();
          if (pattern) {
              searchExamples(pattern, '');
          }
        }

        $('#btn-search').on('click', search);

        $('#btn-clear-search').on('click', function (e) {
          $('#input-search').val('');
          // Restore full tree
          if (typeof _fullTreeData !== 'undefined' && _fullTreeData) {
              initTreeview(JSON.parse(JSON.stringify(_fullTreeData)), '');
          }
        });

        //---------------- Search funcionality ends ------------------------

        //---------------- Search funcionality Fullscreen starts ------------------------

        var searchfs = function(e) {
          var pattern = $('#input-search-fs').val();
          if (pattern) {
              searchExamples(pattern, '-fs');
          }
        }

        $('#btn-search-fs').on('click', searchfs);

        $('#btn-clear-search-fs').on('click', function (e) {
          $('#input-search-fs').val('');
          // Restore full tree
          if (typeof _fullTreeData !== 'undefined' && _fullTreeData) {
              initTreeview(JSON.parse(JSON.stringify(_fullTreeData)), '-fs');
          }
        });

        //---------------- Search funcionality Fullscreen ends ------------------------

        jQuery("#copy-button").on("click", function() {
            var query = editor.getDoc().getValue();
            var $btn = $(this);
            var originalHtml = $btn.html();

            copyToClipboard(query).then(function() {
                $btn.html('<i class="glyphicon glyphicon-ok"></i> Copied!');
                setTimeout(function() {
                    $btn.html(originalHtml);
                }, 1500);
            });
        });

		jQuery("#reset-button").on("click", function() {
            // Clear template state
            _paramMode = false;
            _currentTemplate = null;
            _currentParams = null;
            _currentParsedTitle = null;
            // Clear editor (wrapped in ignore flag to prevent dim trigger)
            _paramIgnoreChange = true;
            editor.getDoc().setValue("");
            _paramIgnoreChange = false;
            // Show welcome panel (per D-09, D-19)
            showWelcomePanel();
        });

        jQuery("#export-csv").on("click",function(){
            var query = editor.getDoc().getValue();
            exportResults(jQuery("#endpoint").val(), query, "csv");
        });

        jQuery("#export-json").on("click",function(){
            var query = editor.getDoc().getValue();
            exportResults(jQuery("#endpoint").val(), query, "json");
        });

        jQuery("#export-xml").on("click",function(){
            var query = editor.getDoc().getValue();
            exportResults(jQuery("#endpoint").val(), query, "xml");
        });

        jQuery("#enter-fullscreen").on("click",function(){
            document.getElementById("fullscreen-navbar").style.display="block";
            document.getElementById("footer").style.display="none";
            editor.setOption("fullScreen", !editor.getOption("fullScreen"));
        });

        jQuery("#exit-fullscreen").on("click",function(){
            document.getElementById("fullscreen-navbar").style.display="none";
            document.getElementById("footer").style.display="block";
            if (editor.getOption("fullScreen")) editor.setOption("fullScreen", false);
        });

        jQuery("#examples-fullscreen").on("click",function(){
            $('#examplesModal').modal();
        });

        jQuery("#show-prefixes").on("click",function(event){
            event.preventDefault();
            prefixesUrl = jQuery("#endpoint").val().replace(/\/$/, "")+"?help=nsdecl";

            fetch(prefixesUrl)
                .then((response) => response.text())
                .then((html) => {
                    document.getElementById("prefixesModalBody").innerHTML = $(html).find('#help > table').prop('outerHTML');
                })
                .catch((error) => {
                    document.getElementById("prefixesModalBody").innerHTML = "<h4>Could not obtain prefix information. This functionality works with Virtuoso-based SPARQL endpoints only.</h4>";
                });

            $('#prefixesModal').modal().find('#prefixesModalBody');
        });

        // Phase 9 — RELIAB-04: permalink guard. Refuse oversized queries with a
        // visible inline message; surface Bitly failures (network/auth) instead
        // of swallowing them in console.log.
        function _showPermalinkInlineMsg(text, isError) {
            var $msg = jQuery('#permalink-inline-msg');
            if ($msg.length === 0) {
                $msg = jQuery('<span id="permalink-inline-msg" class="permalink-inline-msg" style="margin-left:8px;display:inline-block;"></span>');
                jQuery('#generate-permalink').after($msg);
            }
            $msg.text(text);
            $msg.css('color', isError ? '#a94442' : '#3c763d');
            $msg.show();
            clearTimeout(_showPermalinkInlineMsg._timer);
            _showPermalinkInlineMsg._timer = setTimeout(function() { $msg.fadeOut(400); }, 8000);
        }

        jQuery("#generate-permalink").on("click", function(e) {
            e.preventDefault();

            var query = editor.getDoc().getValue();
            query = query.trim();

            // Compute prefixed-query bytes against the Snorql page URL (not the
            // SPARQL endpoint URL — this is the URL the recipient's browser
            // must accept when opening the short link). Acknowledged: a query
            // exactly at maxGetUrlBytes prefixed-encoded may refuse permalink
            // while still executing via GET — fail-closed is correct because
            // the "copy the query text directly" message remains accurate.
            var endpointUrl = jQuery("#endpoint").val().trim();
            var prefixed = (typeof prepareQueryForSend === 'function')
                ? prepareQueryForSend(query)
                : query;
            var maxBytes = (window.SNORQL_CONFIG && window.SNORQL_CONFIG.maxGetUrlBytes) || 4000;
            var permalinkBase = window.location.href.split('?')[0];
            var encodedQuery = encodeURIComponent(prefixed);
            var encodedEndpoint = encodeURIComponent(endpointUrl);
            var totalBytes = permalinkBase.length
                           + '?q='.length + encodedQuery.length
                           + '&endpoint='.length + encodedEndpoint.length;

            if (totalBytes > maxBytes) {
                _showPermalinkInlineMsg(
                    'Query too long to permalink (' + totalBytes + ' bytes; limit ' + maxBytes + '). ' +
                    'Copy the query text directly to share it.',
                    true
                );
                return;
            }

            var queryParam = "?q=" + encodeURIComponent(query) + "&endpoint=" + encodedEndpoint;
            var url = permalinkBase + queryParam;

            var accessToken = "b0021fe4839aefbc4e7967b3578443d9ea6e89bf";
            var params = { "long_url" : url.trim() };

            $.ajax({
                url: "https://api-ssl.bitly.com/v4/shorten",
                cache: false,
                dataType: "json",
                method: "POST",
                contentType: "application/json",
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
                },
                data: JSON.stringify(params)
            }).done(function(data) {
                $('#permalink-url').html("<a href=\""+data.link+"\" target=\"_blank\">"+data.link+"</a>");
                $('#permalinkModal').modal();
            }).fail(function(xhr) {
                _showPermalinkInlineMsg(
                    'Could not shorten the permalink (Bitly request failed). ' +
                    'You can still copy the full URL from the address bar after running the query.',
                    true
                );
            });
        });
    });
})(jQuery);
