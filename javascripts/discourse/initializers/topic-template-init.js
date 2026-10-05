import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import Composer from "discourse/models/composer";

export default apiInitializer("1.14.0", (api) => {
  const site = api.container.lookup("service:site");

  // 1. D-Editor : Intercepte le texte, supprime le tag et l'affiche en filigrane sans le traduire
  api.modifyClass(
    "component:d-editor",
    (Superclass) =>
      class extends Superclass {
        get placeholderTranslated() {
          // Fallback `this.args` au cas où le composant ait été migré vers Glimmer pur
          const placeholder = this.placeholder || this.args?.placeholder;
          const indicator =
            settings.topic_template_placeholder_indicator || "[placeholder]";

          if (placeholder && placeholder.startsWith(indicator)) {
            // Retire la balise et les éventuels espaces juste après
            return placeholder.substring(indicator.length).trimStart();
          }

          // Comportement par défaut de Discourse (traduction des clés i18n normales)
          return placeholder ? i18n(placeholder) : null;
        }
      }
  );

  // 2. Composer-Editor : Fournit le bon texte au D-Editor
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
            const startsWithIndicator = category.topic_template.startsWith(indicator);
            const forceAll = settings.display_all_topic_templates_as_placeholders;

            if (startsWithIndicator || forceAll) {
              // Si forceAll est activé mais que le tag n'y est pas, on l'ajoute virtuellement 
              // pour que d-editor sache qu'il ne doit pas traduire ce long texte.
              return startsWithIndicator
                ? category.topic_template
                : `${indicator}${category.topic_template}`;
            }
          }

          // Retour au fonctionnement standard si pas de tag / pas forcé
          return super.replyPlaceholder;
        }
      }
  );

  // 3. Modèle Composer : Gère si le texte s'insère dans l'éditeur textuel
  const originalApplyTopicTemplate = Composer.prototype.applyTopicTemplate;

  api.addModelMethod(
    "composer",
    "applyTopicTemplate",
    function (oldCategoryId, categoryId) {
      // 1. On laisse Discourse insérer le template normalement
      originalApplyTopicTemplate?.call(this, oldCategoryId, categoryId);

      const category = site.categories.find((cat) => cat.id === categoryId);
      const indicator =
        settings.topic_template_placeholder_indicator || "[placeholder]";

      if (category?.topic_template) {
        const startsWithIndicator = category.topic_template.startsWith(indicator);
        const forceAll = settings.display_all_topic_templates_as_placeholders;

        // 2. Si c'est censé être un placeholder ET que l'éditeur contient actuellement ce template
        if ((startsWithIndicator || forceAll) && this.reply === category.topic_template) {
          // On vide la zone de texte pour laisser apparaître le filigrane
          this.reply = ""; 
        }
      }
    }
  );
});
