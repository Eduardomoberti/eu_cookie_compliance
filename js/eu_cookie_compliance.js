/**
 * @file eu_cookie_compliance.js
 *
 * Defines the behavior of the eu cookie compliance banner.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  Drupal.behaviors.euCookieCompliancePopup = {
    attach: function (context) {
      $('body').once('eu-cookie-compliance').each(function () {
        // If configured, check JSON callback to determine if in EU.
        if (drupalSettings.eu_cookie_compliance.popup_eu_only_js) {
          if (Drupal.eu_cookie_compliance.showBanner()) {
            var url = drupalSettings.path.baseUrl + drupalSettings.path.pathPrefix + 'eu-cookie-compliance-check';
            var data = {};
            $.getJSON(url, data, function (data) {
              // If in the EU, show the compliance banner.
              if (data.in_eu) {
                Drupal.eu_cookie_compliance.execute();
              }

              // If not in EU, set an agreed cookie automatically.
              else {
                Drupal.eu_cookie_compliance.setStatus(2);
              }
            });
          }
        }

        // Otherwise, fallback to standard behavior which is to render the banner.
        else {
          Drupal.eu_cookie_compliance.execute();
        }
      });
    },
  };

  Drupal.eu_cookie_compliance = {};

  Drupal.eu_cookie_compliance.execute = function () {
    try {
      if (!drupalSettings.eu_cookie_compliance.popup_enabled) {
        return;
      }

      if (!Drupal.eu_cookie_compliance.cookiesEnabled()) {
        return;
      }

      var status = Drupal.eu_cookie_compliance.getCurrentStatus();
      if ((status === 0 && drupalSettings.eu_cookie_compliance.method === 'default') || status === null) {
        if (!drupalSettings.eu_cookie_compliance.disagree_do_not_show_popup || status === null) {
          // Detect mobile here and use mobile_popup_html_info, if we have a mobile device.
          if (window.matchMedia('(max-width: ' + drupalSettings.eu_cookie_compliance.mobile_breakpoint + 'px)').matches && drupalSettings.eu_cookie_compliance.use_mobile_message) {
            Drupal.eu_cookie_compliance.createPopup(drupalSettings.eu_cookie_compliance.mobile_popup_html_info);
          } else {
            Drupal.eu_cookie_compliance.createPopup(drupalSettings.eu_cookie_compliance.popup_html_info);
          }

          Drupal.eu_cookie_compliance.attachAgreeEvents();
        }
      } else if (status === 1 && drupalSettings.eu_cookie_compliance.popup_agreed_enabled) {
        Drupal.eu_cookie_compliance.createPopup(drupalSettings.eu_cookie_compliance.popup_html_agreed);
        Drupal.eu_cookie_compliance.attachHideEvents();
      }
    }
    catch (e) {
    }
  };

  Drupal.eu_cookie_compliance.createPopup = function (html) {
    // This fixes a problem with jQuery 1.9.
    var popup = $('<div></div>').html(html);
    popup.attr('id', 'sliding-popup');
    if (!drupalSettings.eu_cookie_compliance.popup_use_bare_css) {
      popup.height(drupalSettings.eu_cookie_compliance.popup_height)
          .width(drupalSettings.eu_cookie_compliance.popup_width);
    }

    popup.hide();
    var height = 0;
    if (drupalSettings.eu_cookie_compliance.popup_position) {
      popup.prependTo('body');
      height = popup.outerHeight();
      popup.show()
        .addClass('sliding-popup-top clearfix')
        .css({ top: -1 * height })
        .animate({ top: 0 }, drupalSettings.eu_cookie_compliance.popup_delay, null, function () {
          popup.trigger('eu_cookie_compliance_popup_open');
        });
    } else {
      if (drupalSettings.eu_cookie_compliance.better_support_for_screen_readers) {
        popup.prependTo('body');
      } else {
        popup.appendTo('body');
      }

      height = popup.outerHeight();
      popup.show()
        .addClass('sliding-popup-bottom')
        .css({ bottom: -1 * height })
        .animate({ bottom: 0 }, drupalSettings.eu_cookie_compliance.popup_delay, null, function () {
          popup.trigger('eu_cookie_compliance_popup_open');
        });
    }
  };

  Drupal.eu_cookie_compliance.attachAgreeEvents = function () {
    var clickingConfirms = drupalSettings.eu_cookie_compliance.popup_clicking_confirmation;
    var scrollConfirms = drupalSettings.eu_cookie_compliance.popup_scrolling_confirmation;

    $('.agree-button').click(Drupal.eu_cookie_compliance.acceptAction);
    $('.decline-button').click(Drupal.eu_cookie_compliance.declineAction);

    if (clickingConfirms) {
      $('a, input[type=submit], button[type=submit]').bind('click.euCookieCompliance', Drupal.eu_cookie_compliance.acceptAction);
    }

    if (scrollConfirms) {
      var alreadyScrolled = false;
      var scrollHandler = function () {
        if (alreadyScrolled) {
          Drupal.eu_cookie_compliance.acceptAction();
          $(window).off('scroll', scrollHandler);
        } else {
          alreadyScrolled = true;
        }
      };

      $(window).bind('scroll', scrollHandler);
    }

    $('.find-more-button').not('.find-more-button-processed').addClass('find-more-button-processed').click(Drupal.eu_cookie_compliance.moreInfoAction);
  };

  Drupal.eu_cookie_compliance.attachHideEvents = function () {
    var popupHideAgreed = drupalSettings.eu_cookie_compliance.popup_hide_agreed;
    var clickingConfirms = drupalSettings.eu_cookie_compliance.popup_clicking_confirmation;
    $('.hide-popup-button').click(function () {
          Drupal.eu_cookie_compliance.changeStatus(2);
        }
    );
    if (clickingConfirms) {
      $('a, input[type=submit], button[type=submit]').unbind('click.euCookieCompliance');
    }

    if (popupHideAgreed) {
      $('a, input[type=submit], button[type=submit]').bind('click.euCookieComplianceHideAgreed', function () {
        Drupal.eu_cookie_compliance.changeStatus(2);
      });
    }

    $('.find-more-button').not('.find-more-button-processed').addClass('find-more-button-processed').click(Drupal.eu_cookie_compliance.moreInfoAction);
  };

  Drupal.eu_cookie_compliance.acceptAction = function () {
    var agreedEnabled = drupalSettings.eu_cookie_compliance.popup_agreed_enabled;
    var nextStatus = 1;
    if (!agreedEnabled) {
      Drupal.eu_cookie_compliance.setStatus(1);
      nextStatus = 2;
    }

    if (!euCookieComplianceHasLoadedScripts) {
      euCookieComplianceLoadScripts();
    }

    if (typeof euCookieComplianceBlockCookies !== 'undefined') {
      clearInterval(euCookieComplianceBlockCookies);
    }

    Drupal.eu_cookie_compliance.changeStatus(nextStatus);
  };

  Drupal.eu_cookie_compliance.declineAction = function () {
    Drupal.eu_cookie_compliance.setStatus(0);
    $('#sliding-popup').animate({ bottom: $('#sliding-popup').outerHeight() * -1 }).trigger('eu_cookie_compliance_popup_close');
  };

  Drupal.eu_cookie_compliance.moreInfoAction = function () {
    if (drupalSettings.eu_cookie_compliance.disagree_do_not_show_popup) {
      Drupal.eu_cookie_compliance.setStatus(0);
      $('#sliding-popup').remove().trigger('eu_cookie_compliance_popup_close');
    } else {
      if (drupalSettings.eu_cookie_compliance.popup_link_new_window) {
        window.open(drupalSettings.eu_cookie_compliance.popup_link);
      } else {
        window.location.href = drupalSettings.eu_cookie_compliance.popup_link;
      }
    }
  };

  Drupal.eu_cookie_compliance.getCurrentStatus = function () {
    var cookieName = (drupalSettings.eu_cookie_compliance.cookie_name === '') ? 'cookie-agreed' : drupalSettings.eu_cookie_compliance.cookie_name;
    var value = $.cookie(cookieName);
    value = parseInt(value);
    if (isNaN(value)) {
      value = null;
    }

    return value;
  };

  Drupal.eu_cookie_compliance.changeStatus = function (value) {
    var status = Drupal.eu_cookie_compliance.getCurrentStatus();
    var reloadPage = drupalSettings.eu_cookie_compliance.reload_page;
    if (status === value) {
      return;
    }

    if (drupalSettings.eu_cookie_compliance.popup_position) {
      $('.sliding-popup-top').animate({ top: $('#sliding-popup').outerHeight() * -1 }, drupalSettings.eu_cookie_compliance.popup_delay, function () {
        if (status === null && !reloadPage) {
          $('#sliding-popup').html(drupalSettings.eu_cookie_compliance.popup_html_agreed).animate({ top: 0 }, drupalSettings.eu_cookie_compliance.popup_delay);
          Drupal.eu_cookie_compliance.attachHideEvents();
        } else if (status === 1) {
          $('#sliding-popup').remove().trigger('eu_cookie_compliance_popup_close');
        }
      });
    } else {
      $('.sliding-popup-bottom').animate({ bottom: $('#sliding-popup').outerHeight() * -1 }, drupalSettings.eu_cookie_compliance.popup_delay, function () {
        if (status === null && !reloadPage) {
          $('#sliding-popup').html(drupalSettings.eu_cookie_compliance.popup_html_agreed).animate({ bottom: 0 }, drupalSettings.eu_cookie_compliance.popup_delay);
          Drupal.eu_cookie_compliance.attachHideEvents();
        } else if (status === 1) {
          $('#sliding-popup').remove().trigger('eu_cookie_compliance_popup_close');
        }
      });
    }

    if (drupalSettings.eu_cookie_compliance.reload_page) {
      location.reload();
    }

    Drupal.eu_cookie_compliance.setStatus(value);
  };

  Drupal.eu_cookie_compliance.setStatus = function (status) {
    var date = new Date();
    var domain = drupalSettings.eu_cookie_compliance.domain ? drupalSettings.eu_cookie_compliance.domain : '';
    var path = drupalSettings.path.baseUrl;
    var cookieName = (drupalSettings.eu_cookie_compliance.cookie_name === '') ? 'cookie-agreed' : drupalSettings.eu_cookie_compliance.cookie_name;
    if (path.length > 1) {
      var pathEnd = path.length - 1;
      if (path.lastIndexOf('/') === pathEnd) {
        path = path.substring(0, pathEnd);
      }
    }

    var cookie_session = parseInt(drupalSettings.eu_cookie_compliance.cookie_session);
    if (cookie_session) {
      $.cookie(cookieName, status, { path: path, domain: domain });
    } else {
      var lifetime = parseInt(drupalSettings.eu_cookie_compliance.cookie_lifetime);
      date.setDate(date.getDate() + lifetime);
      $.cookie(cookieName, status, { expires: date, path: path, domain: domain });
    }
    $(document).trigger('eu_cookie_compliance.changeStatus', [status]);

    // Store consent if applicable.
    if (drupalSettings.eu_cookie_compliance.store_consent && ((status === 1 && drupalSettings.eu_cookie_compliance.popup_agreed_enabled) || (status === 2  && !drupalSettings.eu_cookie_compliance.popup_agreed_enabled))) {
      var url = drupalSettings.path.baseUrl + drupalSettings.path.pathPrefix + 'eu-cookie-compliance/store_consent/banner';
      $.post(url, {}, function (data) { });
    }
  };

  Drupal.eu_cookie_compliance.hasAgreed = function () {
    var status = Drupal.eu_cookie_compliance.getCurrentStatus();
    return (status === 1 || status === 2);
  };

  Drupal.eu_cookie_compliance.showBanner = function () {
    var showBanner = false;
    var status = Drupal.eu_cookie_compliance.getCurrentStatus();
    if ((status === 0 && drupalSettings.eu_cookie_compliance.method === 'default') || status === null) {
      if (!drupalSettings.eu_cookie_compliance.disagree_do_not_show_popup || status === null) {
        showBanner = true;
      }
    } else if (status === 1 && drupalSettings.eu_cookie_compliance.popup_agreed_enabled) {
      showBanner = true;
    }

    return showBanner;
  };

  Drupal.eu_cookie_compliance.cookiesEnabled = function () {
    var cookieEnabled = (navigator.cookieEnabled);
    if (typeof navigator.cookieEnabled === 'undefined' && !cookieEnabled) {
      $.cookie('testcookie', 'testcookie', { expires: 100 });
      cookieEnabled = ($.cookie('testcookie').indexOf('testcookie') !== -1);
    }

    return (cookieEnabled);
  };

  // Load blocked scripts if the user has agreed to being tracked.
  var euCookieComplianceHasLoadedScripts = false;
  $(function () {
    if (Drupal.eu_cookie_compliance.hasAgreed()
        || (Drupal.eu_cookie_compliance.getCurrentStatus() === null && drupalSettings.eu_cookie_compliance.method !== 'opt_in')
    ) {
      euCookieComplianceLoadScripts();
      euCookieComplianceHasLoadedScripts = true;
    }
  });

  // Block cookies when the user hasn't agreed.
  if ((drupalSettings.eu_cookie_compliance.method === 'opt_in' && (Drupal.eu_cookie_compliance.getCurrentStatus() === null  || !Drupal.eu_cookie_compliance.hasAgreed()))
      || (drupalSettings.eu_cookie_compliance.method === 'opt_out' && !Drupal.eu_cookie_compliance.hasAgreed() && Drupal.eu_cookie_compliance.getCurrentStatus() !== null)
  ) {
    // Split the white-listed cookies.
    var euCookieComplianceWhitelist = drupalSettings.eu_cookie_compliance.whitelisted_cookies.split(/\r\n|\n|\r/g);

    // Add the EU Cookie Compliance cookie.
    euCookieComplianceWhitelist.push((drupalSettings.eu_cookie_compliance.cookie_name === '') ? 'cookie-agreed' : drupalSettings.eu_cookie_compliance.cookie_name);
    var euCookieComplianceBlockCookies = setInterval(function () {
      // Load all cookies from jQuery.
      var cookies = $.cookie();

      // Check each cookie and try to remove it if it's not white-listed.
      for (var i in cookies) {
        var remove = true;
        var hostname = window.location.hostname;
        var cookieRemoved = false;
        var index = 0;

        // Skip the PHP session cookie.
        if (i.indexOf('SESS') === 0 || i.indexOf('SSESS') === 0) {
          remove = false;
        }

        // Check if the cookie is white-listed.
        for (var item in euCookieComplianceWhitelist) {
          if (i === euCookieComplianceWhitelist[item]) {
            remove = false;
          }
        }

        // Remove the cookie if it's not white-listed.
        if (remove) {
          while (!cookieRemoved && hostname !== '') {
            // Attempt to remove.
            cookieRemoved = $.removeCookie(i, { domain: '.' + hostname, path: '/' });
            if (!cookieRemoved) {
              cookieRemoved = $.removeCookie(i, { domain: hostname, path: '/' });
            }

            index = hostname.indexOf('.');

            // We can be on a sub-domain, so keep checking the main domain as well.
            hostname = (index === -1) ? '' : hostname.substring(index + 1);
          }
        }
      }
    }, 5000);
  }

})(jQuery, Drupal, drupalSettings);
