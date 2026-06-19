# Singleton (Go)

**Categoria:** Creational  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/singleton/go/example

## Intenção

O Singleton é um padrão de projeto criacional, que garante que apenas um objeto desse tipo exista e forneça um único ponto de acesso a ele para qualquer outro código.

O Singleton tem quase os mesmos prós e contras que as variáveis globais. Embora sejam super úteis, eles quebram a modularidade do seu código.

## Contexto do Exemplo

Você pode usar classes que dependem de singletons em algumas outras situações. Você terá que levar a classe singleton também. Na maioria das vezes, essa limitação surge durante a criação de testes de unidade.

Normalmente, uma instância singleton é criada quando a struct é inicializada pela primeira vez. Para que isso aconteça, definimos o método getInstance na struct. Este método será responsável por criar e retornar a instância singleton. Uma vez criada, a mesma instância singleton será retornada toda vez que getInstance for chamado.

E as goroutines? A struct singleton deve retornar a mesma instância sempre que várias goroutines estiverem tentando acessar essa instância. Por causa disso, é muito fácil implementar incorretamente o padrão de design singleton. O exemplo abaixo ilustra a maneira correta de criar um singleton.

## Implementação em Go

### `single.go` — Singleton

```go
package main

import (
	"fmt"
	"sync"
)

var lock = &sync.Mutex{}

type single struct {
}

var singleInstance *single

func getInstance() *single {
	if singleInstance == nil {
		lock.Lock()
		defer lock.Unlock()
		if singleInstance == nil {
			fmt.Println("Creating single instance now.")
			singleInstance = &single{}
		} else {
			fmt.Println("Single instance already created.")
		}
	} else {
		fmt.Println("Single instance already created.")
	}

	return singleInstance
}
```

### `main.go` — Código cliente

```go
package main

import (
	"fmt"
)

func main() {

	for i := 0; i < 30; i++ {
		go getInstance()
	}

	// Scanln is similar to Scan, but stops scanning at a newline and
	// after the final item there must be a newline or EOF.
	fmt.Scanln()
}
```

### `single.go`

```go
package main

import (
	"fmt"
	"sync"
)

var once sync.Once

type single struct {
}

var singleInstance *single

func getInstance() *single {
	if singleInstance == nil {
		once.Do(
			func() {
				fmt.Println("Creating single instance now.")
				singleInstance = &single{}
			})
	} else {
		fmt.Println("Single instance already created.")
	}

	return singleInstance
}
```

### `main.go` — Código cliente

```go
package main

import (
	"fmt"
)

func main() {

	for i := 0; i < 30; i++ {
		go getInstance()
	}

	// Scanln is similar to Scan, but stops scanning at a newline and
	// after the final item there must be a newline or EOF.
	fmt.Scanln()
}
```
