baseTheme.addModule({
  init(baseTheme) {
    const $ = baseTheme.$;

    const script = () => {
      const els = $("section.hero-section");
      if (!els.length) return;

      els.each(function () {
        const self = $(this);
        // /* none */
      });
    };

    script();
  },
});
