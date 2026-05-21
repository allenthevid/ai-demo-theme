baseTheme.addModule({
  init(baseTheme) {
    const $ = baseTheme.$;

    const script = () => {
      const els = $("section"); /*$("section").filter(function() {
        return (
          $(this).find(".main-title").length > 0
        );
      });*/
      if (!els.length) return;

      els.each(function () {
        const self = $(this);
        const title = self.find(".main-title");
        const eb = self.find(".eyebrow");
        const para = self.find(".subtext");
        const desc = self.find(".description");
        const ah = self.find(".after-heading");
        let mm = gsap.matchMedia();
        let entranceTL = null;
        mm.add(
          {
            isDesktop: `(min-width: 1200px)`,
            isMobile: `(max-width: 1198.98px)`,
          },
          (context) => {
            let { isDesktop, isMobile } = context.conditions;

            if (entranceTL) {
              entranceTL.kill();
              entranceTL = null;
            }

            //entrance anim
            entranceTL = gsap.timeline({
              scrollTrigger: {
                trigger: self,
                start: () =>
                  isDesktop ? "top center" : "top bottom-=120",
                end: "bottom top",
                invalidateOnRefresh: true,
                onRefresh: (self) =>
                  self.progress === 1 && self.animation.progress(1),
                once: false,
              },
            });

            entranceTL.fromTo(
              title,
              {
                autoAlpha: 0,
                y: 60,
              },
              {
                autoAlpha: 1,
                y: 0,
                ease: Power1.easeOut,
                duration: 1,
              }
            );
            if (eb.length) {
              entranceTL.fromTo(
                eb,
                {
                  autoAlpha: 0,
                  y: 60,
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  ease: Power1.easeOut,
                  duration: 0.6,
                },
                "-=0.8"
              );
            }
            entranceTL.fromTo(
              para,
              {
                autoAlpha: 0,
              },
              {
                autoAlpha: 1,
                ease: Power1.easeOut,
                duration: 0.6,
              },
              "-=0.3"
            );
            entranceTL.fromTo(
              desc,
              {
                autoAlpha: 0,
              },
              {
                autoAlpha: 1,
                ease: Power1.easeOut,
                duration: 0.6,
              },
              "-=0.3"
            );
            if (ah.length) {
              ah.each(function(i,e) {
              entranceTL.fromTo(
                e,
                {
                  autoAlpha: 0,
                  y: 60,
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  ease: Power1.easeOut,
                  duration: 0.6,
                },
                "-=0.7"
              );
              });
            }
            ScrollTrigger.refresh(true);

            return () => {};
          }
        );
      });

    };
    
    script();
  },
});
