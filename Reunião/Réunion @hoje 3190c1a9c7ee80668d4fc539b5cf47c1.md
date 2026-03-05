# Réunion @hoje

Resumo

### Itens de Ação

- [ ]  Entrar em contato com a CIPnet para obter acesso ao domínio da Trends
- [ ]  Obter materiais da Trends (logo, identidade visual, cores)
- [ ]  Verificar possibilidade de API ou exportação de dados do UniPlus
- [ ]  Definir domínio final para o aplicativo (gestão.trends ou criar novo domínio)

### Sistema Atual

- O sistema atual é o UniPlus, que gerencia os clientes existentes
- Há aproximadamente 7.700 clientes cadastrados
- O sistema atual possui limitações de acesso remoto
- É necessário avaliar se o UniPlus possui API para integração ou se será necessário exportar dados

### Cálculo de Preços e Orçamentos

- O sistema utilizará uma planilha de preços como base, com diferentes tipos de papel cadastrados
- Cada tipo de papel terá um valor por metro quadrado definido
- Cálculo automático baseado em:
    - Largura do papel em milímetros
    - Altura (com adição automática de 3mm de espaçamento entre etiquetas)
    - Número de colunas
- Sistema de descontos progressivos conforme quantidade (ex: 2%, 3%)
- Margens diferenciadas:
    - Vendedor: 180% de margem
    - Revenda: 110% de margem (desconto maior)

### Gestão de Clientes

- Cadastro de clientes será simplificado, similar ao sistema da MEGS
- Clientes sempre vinculados a um vendedor específico
- Cada vendedor terá acesso apenas aos seus próprios clientes
- Clientes são sempre CNPJ
- Para novos clientes, será necessário criar opção de cadastro no novo sistema

### Fluxo de Trabalho

- O processo inicia com a criação de orçamentos
- Após aprovação, o orçamento se converte em pedido
- Pedidos são enviados para a fábrica
- Imagens das etiquetas podem ser incluídas quando disponíveis, mas não são obrigatórias

### Usuários e Permissões

- Na primeira etapa, apenas perfil de vendedor será implementado
- Inicialmente, todos os usuários terão permissões de admin
- Cada usuário terá seu próprio login

### Planos Futuros

- Sistema de gestão de estoque será implementado posteriormente
- Estoque será controlado em metros quadrados de papel
- Sistema calculará necessidade de compra baseado em pedidos e estoque disponível
- Eventualmente, será adicionado controle de tempo de produção por máquina
- Cadastros de máquinas, tempo de produção e acabamentos serão implementados futuramente

### Aspectos Técnicos

- O sistema será hospedado no domínio da Trends ou MEGS
- Utilizará o sistema da MEGS como base de referência
- Produtos serão cadastrados como tipos de papel
- Cada orçamento será salvo, mas sempre recalculado com preços atuais

Anotações

Transcrição

Tá, pode falar.

Então vamos começar pelos orçamentos. Ali, por hoje, a gente tem um sistema aqui, que é o UniPlus, tá? Nós temos clientes aqui, né?

Tem uma folhinha pra frente pra gente ver aqui.

Tem ainda?

Tem um caderno assim?

E aí?

Nós temos clientes aqui, não sei se vão conseguir usar esses clientes. Vamos incluso.

Deixa eu ver como é que vai ali nos clientes. Não tem alguma opção aí, exportar, imprimir. Tem outras opções ali, ó.

Estou a escrever o que eu não vou falar aqui.

ferramentas lá em cima mas não dá pra aqui se botar imprimir ali no ctrl p ele vai imprimir só ó em excel

Mas isso aí tem que fazer quando cria um novo, né?

Como assim?

Tem os cadastros.

Aqui? Daí tu queria que fosse direto pra lá? É, daí ou teria que ter uma API... Ou teria que ir passando aqui, mas é muito comum vocês ficarem novos clientes?

Bastante comum, tem 7700.

Então, tem que ver como é, é UniPlus, né? É. Ah, depois tem que ver se esse UniPlus tem, vai em ferramentas ali, o que está escrito em ferramentas ali?

Não tem API, talvez tenha que pagar para ele. Fizemos alguns... Qual a importação de nós?

Não sei importar, terei que exportar. Bom, tem que ver se tem... Como?

Tá, daí hoje a gente tem para formular os preços essa planilha que eu te mandei, tá? Que está aqui em preços, ó. Aqui dentro, cada tipo de papel, a gente botou um aqui que já botou os preços. Onde a gente tem todos esses tipos de papéis aqui. borracha, tal, tal, tal, cola a boca de fã, BOPT mentalizado, isso é da marca Fasom, enfim, vai ter que montar um cadastro onde dá o valor por metro quadrado.

E como é que é esse valor por metro quadrado? Tu vai inserir ali?

Isso eu vou inserir.

Tá.

Então tu vai criar o cadastro do tipo de papéis, né? E onde vai ter o metro quadrado.

Aí, ó.

Aí a operadora vai botar a largura do papel em centímetros. Aqui é 10 centímetros. Em milímetros na verdade. Em milímetros. Altura. Daí aqui já coloca mais 3. Pode botar o sistema calcular isso. Sim. É sempre 3 que é o espaçamento entre uma etiqueta e outra.

Tá.

E o número de colunas, né? Uma, duas, três colunas. Tá. Aí o preço que tu vai pegar de lá.

Que é o...

Tá, do papel. Da tabela, que conforme o papel que eu lá colocar, tu vai ter que botar o tipo do papel pra começar. Aí aqui, isso aqui ele calcula, já dá os preços e já dá o custo como ideia. Tá. Aí vem pra essa tabela aqui, né? Que a gente pega esse custo. ... Se o cliente comprar mil, é 58. Essa fórmula está aqui.

2%.

2%, 3%. Conforme vai aumentando, tem desconto. Aí vai ter a opção se ele é vendedor ou se ele é revenda. Porque revenda tem um desconto maior. Mas isso por causa do cadastro do usuário, talvez.

Se o usuário ele é...

Vendedor ou revenda. Aqui a gente trabalha com 180% de margem. E a tempestade é com 110%. E o Jumara não tem mais margem. O Jumara é vendedor e vendedor e vendedor.

Só.

Só começar a ser isso.

Só calcular. E aí isso fecha um pedido?

Fecha um pedido, daí...

Daí todos aqueles dados normais que iriam para a nota fiscal lá, razão social, endereço...

É, fecha um orçamento, na verdade.

Tem algum tipo de orçamento aí?

Você permite um orçamento em um dia de fuga? Permite um orçamento de fuga do cliente em um dia de fuga?

E aí lá fica o orçamento, no princípio.

É, depois, quem quer chegar, vai para o orçamento. Certo? Aí vai para a fábrica. Aí vai querer saber quanto papel para fazer aqueles pedidos que estão encasteados. Quantos papéis, quantos méritos de papel, cada tipo de papel. Ela fechou os 50 mil etiquetas desse aqui. Vai precisar 100 metros quadrados de papel. 200 metros quadrados de papel. Aí vai juntar todos os pedidos e vai formar a obra. Eu preciso ter 500 metros quadrados de papel para fazer...

Fazer isso uma vez por mês? Como é que é?

Todo dia entra pedido.

E daí todo dia está enviando essa quantidade de papel lá para eles?

Para ver se vai faltar ou não, né? Porque daí vai ter o estoque, né? Vai ter o estoque de papel, e os pedidos que tem menos estoque, o que vai faltar para ela saber o que tem que comprar.

Mas o estoque é de quem?

Que nós vamos ter que criar. O objetivo é esse, mas vamos começar pelo orçamento. O orçamento e o pedido, que já vai aliviar bastante a coberta.

E é sempre CNPJ ou pode ser CPF? Pode ser os dois.

Geralmente, não sei se nós temos um caso de NPJ com as coisas, mas...

É sempre CPF?

Sempre CNPJ.

Exatamente, sim.

Tá.

Ok.

Só para tu entender até onde a gente quer chegar, né? Claro. Porque daí depois que gerou o orçamento, confirmou o pedido... Sim. Aí vai para a fábrica e vai gerar uma necessidade de compra. E a necessidade de compra vai abater o estoque. Então tu vai ter que ter um lugar para dar entrada, para ela comprar mercadoria para dar o estoque. Que ela dá em metro quadrado também. E futuramente, futuramente a gente vai colocar o serviço junto.

Para saber quantas horas para produzir aquele papel, cada máquina e tal. Mas isso é mais adiante.

Tá, e aí quem que... Cada um vai ter seu login, como funciona, e daí que tipo de login? Admin, vendedor, operador, todo mundo admin no início.

Nessa primeira etapa, somente vai ter só o vendedor.

Eu faço o login, cada um com seu login, a mesma coisa, cada um... E daí...

Quando a etiqueta, tu põe o que? Desenho da etiqueta aqui? Qualquer? Às vezes eu coloco desenho, às vezes não.

Às vezes a gente não consegue...

Isso aqui está no Word, né?

Não consegue a medida. Nessas imagens vocês têm, né?

Não.

Mas o que tem impressora? A gente não vai usar para impressora isso, não, para falar.

Tá.

Ah, bem tranquilo.

Não, a gente faz uma imagem da etiqueta qualquer. Se tiver uma, qual etiqueta é melhor?

Logins, por enquanto, tudo admin e todo mundo com acesso a todos os clientes. Ou cada um só acessa seus clientes.

Não, pode ser que cada um dos seus clientes só... só não... quando for novo, né? Então tem que criar uma opção de cadastrar? Ou ele vai ter que cadastrar aqui e cadastrar lá?

Não, a princípio a gente vai conseguir puxar os clientes que já tem, a gente consegue puxar. Os novos tem que ver se consegue puxar para a API ou não. Quando cadastra ali tem o vendedor ou não? Aqui no teu sistema. Já tem o vendedor.

Mas então pode... Pode cadastrar ali também, entendeu? Porque depois eles vão ter que cadastrar para fazer o orçamento e pedido, depois na hora de faturar eles cadastram eles aqui, entendeu? Sim. Então cria um cadastro que ele não precisa ter muitas informações, entendeu? Tipo o da Mex, que põe o CNPJ e vem tudo ali.

Tá.

Tu tem essas imagens aqui? Não, não solta não. Essa aqui pega no... Entendi.

Tá.

Bom, vai ter que criar um bancozinho de dados, a gente vai salvando, vai alimentando, uma hora vai ter todas, né?

Sim.

Tá.

Ok.

Então, a princípio, cadastro...

Cadastro de cliente simples e vinculado a um vendedor?

Sempre vinculado a um vendedor.

E cada vendedor só vai ter acesso a seus, então?

Só aos seus clientes.

Onde é que tu vai querer botar esse aplicativo?

No site da Trends, no site da Mags.

Qual o domínio que ele vai ficar? O domínio da Trades hoje está onde?

Está com quem? O domínio está com uma empresa que tem castigo, sei lá. Mas ele pode acessar, porque esse aí a gente não consegue acessar.

Como assim?

Eu não consigo acessar o sistema da Trades fora. Não é uma nuvem, não sei.

Sim, mas esse aqui vai ser.

Hoje nós temos um sistema nosso aqui, né?

Sim, mas vai ser no canil da MEGS, no site.

Tá, mas onde a MEGS tá?

Tá na... Gestão? No gestão, tá no domínio ali, né?

Parece que eu queria vendas, alguma coisa assim, vendas também.

Mas daí eu preciso ter acesso ao domínio da Trends, né? Eu preciso falar com o pessoal que tem ali o acesso pra eles me virar.

Ah, o da MEGS que falou com eles?

Do MEGS, eu falei com os caras, eles me liberaram lá pra fazer, né?

Deixa eu ver aqui o meu...

CIPnet CIPnet Vocês tem contato com eles?

Tem Tu entra em contato, eu entro direto?

Ou, uma outra solução é criar um domínio novo Aí paga seus cento e poucos bilhões por ano

É quando quer falar não?

Tem que ver ali, mas dá um cento e pouco por ano.

Mas a gente paga por melhor de 30?

Sim. O que tem?

Um péssimo, assim mesmo. Grandão assim.

E daí tem que ver para botar ele ali, tá? Eu preciso da... o que que tu tem de material da Trends? Logo, identidade visual, cores... abre o site da Trends aí, tio.

Não tem o site da Trends no Google?

Quem pesquisa no Google?

Eu não consigo ficar todo dia em samba.

Isso é esquema, isso é...

Eu tenho que entrar no celular. Obrigado.

Por que não existe?

Porque o servidor aqui não sei o que, ele me falava uma vez no manual. Quando eles fizeram o site, se não me engano.

Mas não é aquele mesmo cara do Fernando, ó.

É outro. Não, não. Um cara que eu não conheço. Foi feito muito tempo atrás.

Pronto, ele passou o contato, né? Eu corto o WhatsApp que tu me mandou?

Contato. Tá.

Eu falo com eles então. Primeira coisa é isso, não é verdade? A foto me mandou ali na operação, a foto dos caras. Essa aí não aparece antes. O WhatsApp lá no canto tá cortado. Mas eu acho, eu procuro no Google também. Não, é com... faltou o i ali, é cipnet, eu acho. Não, é com... Tem o I, né? CIP. Ah, tá sem o Matos. Tá, mas eu entro em contato.

O objetivo todo é esse, só para fazer a... depois eu quero trocar as nossas cadastras de máquina, o tempo de máquina, o acabamento de quente e tal.

Vamos fazer o mesmo padrão ali da MEGS. Isso. Usar a MEGS como base. Não vou ficar grande nesse teu computador as coisas não.

Os cortes que elas vendem.

Que no caso vai ser orçamento, né?

Os produtos que não vai ter, porque...

Ah, produtos vai ser os papéis, né? Os tipos de papéis.

Isso, né? Mas o produto final, a etiqueta, cada um...

Vai montar a sua, né?

Vai montar a sua, vai botar as medidas...

Sim, mas a base que é os papéis, sim, né?

Quando ele botar, já põe, ó, 160, tal, tal, tal. Isso aqui tu vai tirar daquela que ele informou lá no lançamento.

Ah, eu vou fazer ali, vai ficar errado, daí tu vai, vamos corrigir mais rápido e tentar fazer tudo perfeito em versão.

Então, vai ter os produtos aqui, o cadastro vai ter, ao menos que tiver já... Tipo... Quem já contou isso aqui, não sei se vale a pena guardar, mas... Não, porque pode ter variado o valor do papel. Então não salvo. Toda vez eles vão botar novo.

Não, salvar eu vou salvar, mas não vou fazer nada. Deixa eu salvar. De nada está ali.

Não, deixa eu salvar o produto em cima. Sim. É, isso aqui está ótimo.

Tá. Ok.

E aí o nome vai ser? Ali é gestão.megspatch. Já está gestão.treinos?

Gestão não, foi em Vênus. Ou Fábio.

Ok, então, vamos ver se salvou agora.

Valeu.