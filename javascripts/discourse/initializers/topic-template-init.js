import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import Composer from "discourse/models/composer"; // Import direct du modèle

export default apiInitializer("1.14.0", (api) => {
  const site = api.container.lookup("service:site");

  // 1. Extend D-Editor component (Les composants supportent toujours modifyClass)
  api.modifyClass(
    "component:d-editor",
    (Superclass) =>
      class extends Superclass {
        get placeholderTranslated() {
          const placeholder = this.placeholder;
          const indicator =
            settings.topic_template_placeholder_indicator || "[placeholder]";

          if (placeholder?.startsWith(indicator)) {
            return placeholder.replace(indicator, "");
          }

          return placeholder ? i18n(placeholder) : null;
        }
      }
  );

  // 2. Extend composer-editor component
  api.modifyClass(
    "component:composer-editor",
    (Superclass) =>
      class extends Superclass {
        get replyPlaceholder() {
          const categoryId = this.composer?.model?.categoryId;

          if (this.topic && settings.only_apply_on_first_post) {
            return super.replyPlaceholder;
          }

          const category = site.categories.find((cat) => cat.id === categoryId);
          const indicator =
            settings.topic_template_placeholder_indicator || "[placeholder]";

          if (category?.topic_template) {
            if (
              settings.display_all_topic_templates_as_placeholders ||
              category.topic_template.startsWith(indicator)
            ) {
              return category.topic_template.startsWith(indicator)
                ? category.topic_template
                : `${indicator}${category.topic_template}`;
            }
          }

          return super.replyPlaceholder;
        }
      }
  );

  // 3. NOUVELLE APPROCHE POUR LE MODÈLE (Correction de la dépréciation)
  // On capture la fonction d'origine pour remplacer l'appel à `super()`
  const originalApplyTopicTemplate = Composer.prototype.applyTopicTemplate;

  // Utilisation de la nouvelle API addModelMethod recommandée par Discourse
  api.addModelMethod(
    "composer",
    "applyTopicTemplate",
    function (oldCategoryId, categoryId) {
      // Équivalent de super.applyTopicTemplate?.(oldCategoryId, categoryId);
      originalApplyTopicTemplate?.call(this, oldCategoryId, categoryId);

      const category = site.categories.find((cat) => cat.id === categoryId);
      const indicator =
        settings.topic_template_placeholder_indicator || "[placeholder]";

      if (
        category?.topic_template &&
        (settings.display_all_topic_templates_as_placeholders ||
          this.reply?.startsWith(indicator)) &&
        category.topic_template === this.reply
      ) {
        this.reply = ""; // Syntaxe native (remplace this.set)
      }
    }
  );
});
