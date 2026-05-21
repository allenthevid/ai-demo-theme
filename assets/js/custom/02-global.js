(function (app) {
    "use strict";
    var $ = jQuery.noConflict();

    app.Global = {
        init() {
            app.Global.handleDownloadLinks();
        },

        refreshScrollTriggers() {
            const triggers = ScrollTrigger.getAll();
            triggers.forEach((trigger) => {
                if (trigger.vars.id == 'nav-bg-scroll' || trigger.vars.id == 'nav-bg-hide') return;
                trigger.refresh(true);
            });
        },

        handleDownloadLinks() {
            const links = $(`a[href^="download:"]`);
            if (!links.length) return;
            links.each(function () {
                const self = $(this);
                const href = self.attr('href');
                self.attr('href', href.replace('download:', ''));
                self.attr('download', '');
            });
        },

        updateSelectClass(target) {
            const parent = target.selectmenu("menuWidget");
            parent.find(".selected").removeClass("selected");
            const activeItem = parent.find(".ui-state-active");
            activeItem.addClass("selected");
        },
    };

    app.ready(function () {
        app.Global.init();
    });
})(window.app);
